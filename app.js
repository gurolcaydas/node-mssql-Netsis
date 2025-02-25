// Add this route to your existing app.js or routes file

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
    const pool = await sql.connect(config);
    
    // First, get the total count for pagination
    const countResult = await pool.request()
      .input('query', sql.NVarChar, `%${query}%`)
      .query(`
        SELECT COUNT(*) AS total
        FROM STOKLAR
        WHERE STOK_KODU LIKE @query
        OR STOK_ADI LIKE @query
      `);
    
    const totalCount = countResult.recordset[0].total;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Then get the actual results for the current page
    const result = await pool.request()
      .input('query', sql.NVarChar, `%${query}%`)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT STOK_KODU, STOK_ADI, KOD1, KOD2
        FROM STOKLAR
        WHERE STOK_KODU LIKE @query
        OR STOK_ADI LIKE @query
        ORDER BY STOK_KODU
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
      error: 'An error occurred while searching for products.'
    });
  }
}); 