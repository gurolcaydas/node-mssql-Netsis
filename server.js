const express = require('express');
const sql = require('mssql');
const path = require('path');
const excel = require('exceljs');
const { dbConfig } = require('./config');

const app = express();
const port = 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views'); // Folder for templates

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to render homepage with database data
app.get('/', async (req, res) => {
    try {
        // Get product code from query parameter, with default value
        const productCode = req.query.productCode || '';
        
        let pool = await sql.connect(dbConfig);
        
        // Product details query
        const query = `
        SELECT 
            A.[STOK_KODU],
            [URETICI_KODU],
            [STOK_ADI],
            [GRUP_KODU],
            [DEPO_KODU],
            [OLCU_BR1],
            [OLCU_BR2],
            [OLCU_BR3],
            [PAY_1],
            [PAYDA_1],
            [PAY2],
            [PAYDA2],
            B1.[GRUP_ISIM] AS KOD1,
            B2.[GRUP_ISIM] AS KOD2,
            B3.[GRUP_ISIM] AS KOD3,
            B4.[GRUP_ISIM] AS KOD4,
            A.KOD_5 AS KOD5,
            A2.[INGISIM],
            A2.[KAYITTARIHI],
            A2.[KAYITYAPANKUL],
            A2.[DUZELTMETARIHI],
            A2.[DUZELTMEYAPANKUL],
            'tr' AS ESKITR,
            'en' AS ESKIEN,
            '2' AS ESKITR2
        FROM [ACCELL2022].[dbo].[TBLSTSABIT] A WITH (NOLOCK)
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTSABITEK] A2 WITH (NOLOCK) ON A.[STOK_KODU] = A2.[STOK_KODU]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD1] B1 WITH (NOLOCK) ON A.[KOD_1] = B1.[GRUP_KOD]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD2] B2 WITH (NOLOCK) ON A.[KOD_2] = B2.[GRUP_KOD]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD3] B3 WITH (NOLOCK) ON A.[KOD_3] = B3.[GRUP_KOD]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD4] B4 WITH (NOLOCK) ON A.[KOD_4] = B4.[GRUP_KOD]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD5] B5 WITH (NOLOCK) ON A.[KOD_5] = B5.[GRUP_KOD]
        WHERE A.[STOK_KODU] = @productCode
        `;
        
        const result = await pool.request()
          .input('productCode', sql.VarChar, productCode)
          .query(query);
        
        res.render('index', {
            title: 'Product Details',
            productCode: productCode,
            data: result.recordset
        });
    } catch (err) {
        console.error('Database error:', err);
        res.render('index', {
            title: 'Product Details',
            data: [],
            error: 'Failed to fetch data from database: ' + err.message
        });
    }
});

// BOM Route
app.get('/BOM', async (req, res) => {
    try {
        // Get product code from query parameter, with default value AT21-2461-36545
        const productCode = req.query.productCode || '';
        
        // Connect to database
        const pool = await sql.connect(dbConfig);
        
        // The BOM query with parameterized product code
        const query = `
        WITH Liste AS (
          SELECT 
              CAST(A.[OPNO] AS VARCHAR(250)) AS SortOrder,
              CAST(1 AS INT) AS LeveL,
              A.[MAMUL_KODU],
              A.[HAM_KODU],
              A.[MIKTAR],
              A.[STOK_MALIYET]
          FROM [ACCELL2022].[dbo].[TBLSTOKURM] A WITH (NOLOCK)
          WHERE A.[MAMUL_KODU] = @productCode AND A.[GEC_FLAG] = 0
          UNION ALL
          SELECT 
              CAST(C.[SortOrder] + '.' + B.[OPNO] AS VARCHAR(250)) AS Sort2,
              CAST(C.[LeveL] + 1 AS INT) AS Level2,
              B.[MAMUL_KODU],
              B.[HAM_KODU],
              B.[MIKTAR],
              B.[STOK_MALIYET]
          FROM [ACCELL2022].[dbo].[TBLSTOKURM] B WITH (NOLOCK)
          JOIN Liste AS C ON C.[HAM_KODU] = B.[MAMUL_KODU]
          WHERE B.[GEC_FLAG] = 0
        )
        SELECT 
          Y.SortOrder,
          Y.LeveL,
          Y.[MAMUL_KODU],
          Y.[HAM_KODU],
          G.[GRUP_ISIM],
          E.[STOK_ADI],
          Y.[MIKTAR],
          E.[OLCU_BR1],
          K.[GRUP_ISIM] AS Tedarikci,
          Z.[FIYAT1],
          Z.[FIYATDOVIZTIPI],
          Z.[OLCUBR],
          J.[OPKODU] AS Operasyon_kodu,
          J.[OPISIM] AS Operasyon,
          J.[OPMIK] AS Operasyon_miktar,
          H.[MIKTAR] AS Alt_Urun,
          Y.[STOK_MALIYET] AS Maliyet
        FROM Liste Y
        OUTER APPLY (
          SELECT TOP 1 [FIYAT1], [FIYATDOVIZTIPI], [OLCUBR] 
          FROM [ACCELL2022].[dbo].[TBLSTOKFIAT] WITH (NOLOCK) 
          WHERE Y.HAM_KODU = [STOKKODU] 
          ORDER BY [BASTAR] DESC
        ) Z
        OUTER APPLY (
          SELECT TOP 1 [MIKTAR] 
          FROM [ACCELL2022].[dbo].[TBLSTOKURM] WITH (NOLOCK) 
          WHERE Y.[HAM_KODU] = [MAMUL_KODU]
        ) H
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTSABIT] E WITH (NOLOCK) ON Y.[HAM_KODU] = E.[STOK_KODU]
        LEFT JOIN [ACCELL2022].[dbo].[TBLOPERATIONS_KATALOG] J WITH (NOLOCK) ON Y.[HAM_KODU] = J.[OPKODU]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD2] K WITH (NOLOCK) ON E.[KOD_2] = K.[GRUP_KOD]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD1] G WITH (NOLOCK) ON E.[KOD_1] = G.[GRUP_KOD]
        ORDER BY SortOrder
        `;
        
        const result = await pool.request()
          .input('productCode', sql.VarChar, productCode)
          .query(query);
        
        res.render('bom', { 
          title: 'Bill of Materials (BOM)',
          productCode: productCode,
          data: result.recordset
        });
        
    } catch (err) {
        console.error('Database error:', err);
        res.render('bom', { 
          title: 'Bill of Materials (BOM)',
          error: 'Error retrieving BOM data: ' + err.message
        });
    }
});

// Search route
app.get('/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of results per page
    const offset = (page - 1) * limit;
    
    if (!query) {
      // If no query is provided, just render the search page
      return res.render('search', { 
        title: 'Product Search',
        query: '',
        results: []
      });
    }
    
    // Create a connection to the database
    const pool = await sql.connect(dbConfig);
    
    // First, get the total count for pagination
    const countResult = await pool.request()
      .input('query', sql.NVarChar, `%${query}%`)
      .query(`
        SELECT COUNT(*) AS total
        FROM [ACCELL2022].[dbo].[TBLSTSABIT] A WITH (NOLOCK)
        WHERE A.[STOK_KODU] LIKE @query
        OR A.[STOK_ADI] LIKE @query
      `);
    
    const totalCount = countResult.recordset[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Then get the actual results for the current page
    const result = await pool.request()
      .input('query', sql.NVarChar, `%${query}%`)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT 
          A.[STOK_KODU],
          A.[STOK_ADI],
          B1.[GRUP_ISIM] AS KOD1,
          B2.[GRUP_ISIM] AS KOD2
        FROM [ACCELL2022].[dbo].[TBLSTSABIT] A WITH (NOLOCK)
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD1] B1 WITH (NOLOCK) ON A.[KOD_1] = B1.[GRUP_KOD]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD2] B2 WITH (NOLOCK) ON A.[KOD_2] = B2.[GRUP_KOD]
        WHERE A.[STOK_KODU] LIKE @query
        OR A.[STOK_ADI] LIKE @query
        ORDER BY A.[STOK_KODU]
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);
    
    res.render('search', {
      title: 'Product Search',
      query: query,
      results: result.recordset,
      currentPage: page,
      totalPages: totalPages
    });
    
  } catch (err) {
    console.error('Database error:', err);
    res.render('search', {
      title: 'Product Search',
      query: req.query.query || '',
      error: 'An error occurred while searching for products: ' + err.message
    });
  }
});

// Export BOM to Excel
app.get('/BOM/export', async (req, res) => {
    try {
        const productCode = req.query.productCode;
        
        if (!productCode) {
            return res.status(400).send('Product code is required');
        }
        
        // Connect to database
        const pool = await sql.connect(dbConfig);
        
        // Use the same query as in the BOM route
        const query = `
        WITH Liste AS (
          SELECT 
              CAST(A.[OPNO] AS VARCHAR(250)) AS SortOrder,
              CAST(1 AS INT) AS LeveL,
              A.[MAMUL_KODU],
              A.[HAM_KODU],
              A.[MIKTAR],
              A.[STOK_MALIYET]
          FROM [ACCELL2022].[dbo].[TBLSTOKURM] A WITH (NOLOCK)
          WHERE A.[MAMUL_KODU] = @productCode AND A.[GEC_FLAG] = 0
          UNION ALL
          SELECT 
              CAST(C.[SortOrder] + '.' + B.[OPNO] AS VARCHAR(250)) AS Sort2,
              CAST(C.[LeveL] + 1 AS INT) AS Level2,
              B.[MAMUL_KODU],
              B.[HAM_KODU],
              B.[MIKTAR],
              B.[STOK_MALIYET]
          FROM [ACCELL2022].[dbo].[TBLSTOKURM] B WITH (NOLOCK)
          JOIN Liste AS C ON C.[HAM_KODU] = B.[MAMUL_KODU]
          WHERE B.[GEC_FLAG] = 0
        )
        SELECT 
          Y.SortOrder,
          Y.LeveL,
          Y.[MAMUL_KODU],
          Y.[HAM_KODU],
          G.[GRUP_ISIM],
          E.[STOK_ADI],
          Y.[MIKTAR],
          E.[OLCU_BR1],
          K.[GRUP_ISIM] AS Tedarikci,
          Z.[FIYAT1],
          Z.[FIYATDOVIZTIPI],
          Z.[OLCUBR],
          J.[OPKODU] AS Operasyon_kodu,
          J.[OPISIM] AS Operasyon,
          J.[OPMIK] AS Operasyon_miktar,
          H.[MIKTAR] AS Alt_Urun,
          Y.[STOK_MALIYET] AS Maliyet
        FROM Liste Y
        OUTER APPLY (
          SELECT TOP 1 [FIYAT1], [FIYATDOVIZTIPI], [OLCUBR] 
          FROM [ACCELL2022].[dbo].[TBLSTOKFIAT] WITH (NOLOCK) 
          WHERE Y.HAM_KODU = [STOKKODU] 
          ORDER BY [BASTAR] DESC
        ) Z
        OUTER APPLY (
          SELECT TOP 1 [MIKTAR] 
          FROM [ACCELL2022].[dbo].[TBLSTOKURM] WITH (NOLOCK) 
          WHERE Y.[HAM_KODU] = [MAMUL_KODU]
        ) H
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTSABIT] E WITH (NOLOCK) ON Y.[HAM_KODU] = E.[STOK_KODU]
        LEFT JOIN [ACCELL2022].[dbo].[TBLOPERATIONS_KATALOG] J WITH (NOLOCK) ON Y.[HAM_KODU] = J.[OPKODU]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD2] K WITH (NOLOCK) ON E.[KOD_2] = K.[GRUP_KOD]
        LEFT JOIN [ACCELL2022].[dbo].[TBLSTOKKOD1] G WITH (NOLOCK) ON E.[KOD_1] = G.[GRUP_KOD]
        ORDER BY SortOrder
        `;
        
        const result = await pool.request()
          .input('productCode', sql.VarChar, productCode)
          .query(query);
        
        // Create a new Excel workbook
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('BOM');
        
        // Add headers
        worksheet.columns = [
            { header: 'Level', key: 'level', width: 10 },
            { header: 'Component Code', key: 'code', width: 20 },
            { header: 'Component Name', key: 'name', width: 30 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Quantity', key: 'quantity', width: 15 },
            { header: 'Unit', key: 'unit', width: 10 },
            { header: 'Supplier', key: 'supplier', width: 20 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Currency', key: 'currency', width: 10 }
        ];
        
        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4A6FA5' }
        };
        worksheet.getRow(1).font = {
            color: { argb: 'FFFFFF' },
            bold: true
        };
        
        // Add data rows
        result.recordset.forEach(item => {
            worksheet.addRow({
                level: item.LeveL,
                code: item.HAM_KODU,
                name: item.STOK_ADI || 'N/A',
                category: item.GRUP_ISIM || 'N/A',
                quantity: item.MIKTAR || 0,
                unit: item.OLCU_BR1 || 'N/A',
                supplier: item.Tedarikci || 'N/A',
                price: item.FIYAT1 || 'N/A',
                currency: item.FIYATDOVIZTIPI || 'N/A'
            });
        });
        
        // Apply conditional formatting based on level
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                const level = row.getCell('level').value;
                let fillColor;
                
                switch(level) {
                    case 1:
                        fillColor = 'E6EEF8'; // Light blue
                        break;
                    case 2:
                        fillColor = 'EBF5EB'; // Light green
                        break;
                    case 3:
                        fillColor = 'FFF8E6'; // Light yellow
                        break;
                    case 4:
                        fillColor = 'F9E6E6'; // Light red
                        break;
                    case 5:
                        fillColor = 'F0E6F9'; // Light purple
                        break;
                    default:
                        fillColor = 'FFFFFF'; // White
                }
                
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: fillColor }
                };
                
                // Add indentation based on level
                row.getCell('name').alignment = {
                    indent: level - 1
                };
            }
        });
        
        // Set the response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=BOM_${productCode}.xlsx`);
        
        // Write the workbook to the response
        await workbook.xlsx.write(res);
        
    } catch (err) {
        console.error('Error exporting BOM to Excel:', err);
        res.status(500).send('Error generating Excel file: ' + err.message);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});