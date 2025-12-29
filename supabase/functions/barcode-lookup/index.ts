import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let barcode;
    let action;
    let productName;
    let productBrand;
    let bodyText = "";

    try {
      bodyText = await req.text();
      if (bodyText) {
        const jsonBody = JSON.parse(bodyText);
        barcode = jsonBody.barcode;
        action = jsonBody.action;
        productName = jsonBody.productName;
        productBrand = jsonBody.brand;
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'JSON Parse Error', details: e.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- MODO REPARACIÓN DE IMAGEN ---
    if (action === 'fix_image' && productName) {
      const apiKey = Deno.env.get('GOOGLE_API_KEY');
      const cx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
      if (!apiKey || !cx) {
        return new Response(JSON.stringify({ error: 'Google API invalid' }), { status: 500, headers: corsHeaders });
      }

      try {
        let query = productName;
        if (productBrand && productBrand !== 'Unknown (Google)') {
          query = `${productBrand} ${productName}`;
        }
        query = query.split(' - ')[0].substring(0, 50);

        console.log(`Fixing image for: ${query}`);

        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=1`;
        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));

        if (data.items && data.items.length > 0) {
          return new Response(
            JSON.stringify({ image_url: data.items[0].link }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(JSON.stringify({ error: 'No image found' }), { status: 404, headers: corsHeaders });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Missing barcode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Helpers ---

    const validateImage = async (url: string | null): Promise<boolean> => {
      if (!url) return false;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok;
      } catch {
        return false;
      }
    }

    const searchImageOnGoogle = async (query: string): Promise<string | null> => {
      const apiKey = Deno.env.get('GOOGLE_API_KEY');
      const cx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
      if (!apiKey || !cx) return null;

      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=1`;
        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));

        if (data.items && data.items.length > 0) {
          return data.items[0].link || null;
        }
      } catch (e) { console.error("Google Image Search error", e); }
      return null;
    }


    // --- FUENTES DE DATOS ---

    const lookupBarcodeLookup = async (code: string) => {
      const apiKey = Deno.env.get('BARCODELOOKUP_KEY') || 'a1zm6pbehudqs6i1zvfrsrvvc9qjje';
      if (!apiKey) return null;

      try {
        console.log(`Searching BarcodeLookup for ${code}...`);
        const response = await fetch(`https://api.barcodelookup.com/v3/products?barcode=${code}&formatted=y&key=${apiKey}`);
        const data = await response.json().catch(() => ({}));

        if (response.ok && data.products && data.products.length > 0) {
          const p = data.products[0];
          return {
            name: p.title,
            brand: p.brand,
            description: p.description,
            category: p.category,
            image: p.images && p.images.length > 0 ? p.images[0] : null,
            source: 'barcodelookup'
          };
        }
      } catch (e) {
        console.error('BarcodeLookup error:', e);
      }
      return null;
    };

    const lookupUPCitemdb = async (code: string) => {
      try {
        const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
        const data = await response.json().catch(() => ({}));

        if (response.ok && data.items && data.items.length > 0) {
          const product = data.items[0];
          return {
            name: product.title,
            description: product.description,
            brand: product.brand,
            category: product.category,
            image: product.images && product.images.length > 0 ? product.images[0] : null,
            source: 'upcitemdb'
          };
        }
      } catch (e) { /* ignore */ }
      return null;
    };

    const lookupOpenProducts = async (code: string) => {
      try {
        const response = await fetch(`https://world.openproductsfacts.org/api/v0/product/${code}.json`);
        const data = await response.json().catch(() => ({}));

        if (data.status === 1 && data.product) {
          const p = data.product;
          return {
            name: p.product_name || p.product_name_en || p.product_name_fr,
            brand: p.brands,
            description: p.generic_name,
            category: p.categories,
            image: p.image_url || p.image_front_url,
            source: 'openproductsfacts'
          };
        }
      } catch (e) { /* ignore */ }
      return null;
    };

    const lookupOpenFood = async (code: string) => {
      try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
        const data = await response.json().catch(() => ({}));

        if (data.status === 1 && data.product) {
          const p = data.product;
          return {
            name: p.product_name || p.product_name_fr || p.product_name_en,
            brand: p.brands,
            description: p.generic_name || p.ingredients_text,
            category: p.categories,
            image: p.image_url || p.image_front_url,
            source: 'openfoodfacts'
          };
        }
      } catch (e) { /* ignore */ }
      return null;
    };

    // NUEVA ESTRATEGIA: Búsqueda de Código como IMAGEN
    const lookupGoogleImages = async (code: string) => {
      const apiKey = Deno.env.get('GOOGLE_API_KEY');
      const cx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

      if (!apiKey || !cx) return null;

      try {
        // searchType=image es vital para encontrar el código en ALT text
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${code}&searchType=image&num=1`;
        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json().catch(() => ({}));

        if (data.items && data.items.length > 0) {
          const item = data.items[0];
          return {
            name: item.title,
            brand: 'Unknown (Google)',
            description: item.snippet || item.image?.contextLink,
            category: 'General',
            image: item.link,
            source: 'google_image_search'
          };
        }
      } catch (e) { console.error("Google Image Search error", e); }
      return null;
    };

    // --- LÓGICA DE CASCADA SECUENCIAL OPTIMIZADA ---

    let variants = [barcode];
    if (barcode.length === 13 && barcode.startsWith('0')) variants.push(barcode.substring(1));
    if (barcode.length === 12) variants.push('0' + barcode);

    let foundProduct = null;

    for (const code of variants) {
      // --- 1. UPCitemdb (100 daily requests - Free) ---
      foundProduct = await lookupUPCitemdb(code);
      if (foundProduct) break;

      // --- 2. OpenProductsFacts (Unlimited) ---
      foundProduct = await lookupOpenProducts(code);
      if (foundProduct) break;

      foundProduct = await lookupOpenFood(code);
      if (foundProduct) break;

      // --- 3. Google Image Search (Optimization for ALT text) ---
      // ESTA FUE LA QUE FUNCIONÓ PARA EL CÓDIGO 197600410619
      if (code === barcode) {
        foundProduct = await lookupGoogleImages(code);
        if (foundProduct) break;
      }

      // --- 4. BarcodeLookup (Premium - Panic Button) ---
      foundProduct = await lookupBarcodeLookup(code);
      if (foundProduct) break;
    }

    if (foundProduct) {
      // Validación básica de imagen
      const isImageValid = await validateImage(foundProduct.image);
      if (!isImageValid) {
        console.log(`Image invalid for ${foundProduct.name}, trying fallback...`);
        // Fallback a imagen de Google si la principal falla
        let query = foundProduct.name;
        if (foundProduct.brand && foundProduct.brand !== 'Unknown (Google)') {
          query = `${foundProduct.brand} ${foundProduct.name}`;
        }
        query = query.split(' - ')[0].substring(0, 50);
        const fallbackImage = await searchImageOnGoogle(query);
        if (fallbackImage) {
          foundProduct.image = fallbackImage;
          foundProduct.source += ' + google_image_fallback';
        } else {
          foundProduct.image = null;
        }
      }

      // Limpieza final de strings
      let cleanName = foundProduct.name || 'Producto sin nombre';
      cleanName = cleanName.split(' - ')[0];
      cleanName = cleanName.split(' | ')[0];
      cleanName = cleanName.replace(/\([^)]*\)/g, '').trim();
      const sizeIndex = cleanName.toLowerCase().indexOf(' size ');
      if (sizeIndex > 0) cleanName = cleanName.substring(0, sizeIndex).trim();

      const cleanDescription = (foundProduct.description || foundProduct.name || '').substring(0, 200);

      return new Response(
        JSON.stringify({
          name: cleanName,
          brand: foundProduct.brand || 'Sin marca',
          description: cleanDescription,
          category: foundProduct.category || 'General',
          image: foundProduct.image,
          source: foundProduct.source
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
