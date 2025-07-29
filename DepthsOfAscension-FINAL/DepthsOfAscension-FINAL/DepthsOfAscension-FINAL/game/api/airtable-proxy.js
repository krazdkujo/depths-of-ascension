/**
 * Airtable Proxy - Serverless function to handle all Airtable operations
 * Keeps API keys secure on the server side
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Get environment variables
    const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    
    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
        console.error('Missing Airtable configuration');
        return res.status(500).json({ error: 'Server configuration error' });
    }
    
    try {
        const { action, table, data, baseId } = req.body;
        
        if (!action || !table) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        // Construct Airtable API URL
        const baseUrl = `https://api.airtable.com/v0/${baseId || AIRTABLE_BASE_ID}/${table}`;
        
        let url = baseUrl;
        let method = 'GET';
        let body = null;
        
        // Configure request based on action
        switch (action) {
            case 'create':
                method = 'POST';
                body = JSON.stringify({
                    records: [{ fields: data.fields }]
                });
                break;
                
            case 'read':
                method = 'GET';
                if (data.filterByFormula) {
                    url += `?filterByFormula=${encodeURIComponent(data.filterByFormula)}`;
                }
                if (data.maxRecords) {
                    url += url.includes('?') ? '&' : '?';
                    url += `maxRecords=${data.maxRecords}`;
                }
                if (data.sort) {
                    url += url.includes('?') ? '&' : '?';
                    url += `sort[0][field]=${data.sort.field}&sort[0][direction]=${data.sort.direction || 'asc'}`;
                }
                break;
                
            case 'update':
                method = 'PATCH';
                url += `/${data.id}`;
                body = JSON.stringify({
                    fields: data.fields
                });
                break;
                
            case 'delete':
                method = 'DELETE';
                url += `/${data.id}`;
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        
        // Make request to Airtable
        const headers = {
            'Authorization': `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json'
        };
        
        const response = await fetch(url, {
            method,
            headers,
            body
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            console.error('Airtable API error:', responseData);
            return res.status(response.status).json({
                error: 'Airtable API error',
                details: responseData.error
            });
        }
        
        // Return the data
        res.status(200).json(responseData);
        
    } catch (error) {
        console.error('Airtable proxy error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}