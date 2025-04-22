export const searchProducts = async (query:string) => {
    const response = await fetch('/api/search-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
  
    if (!response.ok) {
      throw new Error('Failed to fetch product search results');
    }
  
    return response.json();
  };
  