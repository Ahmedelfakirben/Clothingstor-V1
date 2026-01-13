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
    let image;
    let bodyText = "";

    // --- Helpers Definitions (Hoisted) ---
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

    const lookupBarcodeLookup = async (code: string) => {
      const apiKey = Deno.env.get('BARCODELOOKUP_KEY');
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

    const lookupGoogleImages = async (code: string) => {
      const apiKey = Deno.env.get('GOOGLE_API_KEY');
      const cx = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
      if (!apiKey || !cx) return null;
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${code}&searchType=image&num=1`;
        const response = await fetch(url);
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

    try {
      bodyText = await req.text();
      if (bodyText) {
        const jsonBody = JSON.parse(bodyText);
        barcode = jsonBody.barcode;
        action = jsonBody.action;
        productName = jsonBody.productName;
        productBrand = jsonBody.brand;
        image = jsonBody.image;
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

    // --- MODO ANÁLISIS VISUAL (IA) ---
    if (action === 'analyze_image' && image) {
      console.log('🧠 Starting Visual Analysis with Qwen/Llama Vision...');
      const groqApiKey = Deno.env.get('GROQ_API_KEY');

      if (!groqApiKey) {
        return new Response(JSON.stringify({ error: 'Groq API Key missing' }), { status: 500, headers: corsHeaders });
      }

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct", // Replacement for Llama 3.2 Vision
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Identify this product based on the image. Return a strictly valid JSON object (no markdown) with keys: name (short title), brand, category, description (short), color, material, gender (Male, Female, Unisex, Kids), season (Summer, Winter, All Season), reference (Look for short alphanumeric codes like 'KT0463', usually 6 chars, appearing near barcode or name). Language: French." },
                  {
                    type: "image_url",
                    image_url: {
                      url: image // Base64 Data URL
                    }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 300,
            response_format: { type: "json_object" } // Force JSON
          })
        });

        const data = await response.json();
        console.log("🧠 Vision API Full Response:", JSON.stringify(data));

        if (data.error) {
          throw new Error(`Groq API Error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        if (data.choices && data.choices.length > 0) {
          let content = data.choices[0].message.content;
          console.log("📝 Raw Content from LLM:", content);

          // Limpieza robusta de Markdown (```json ... ```)
          content = content.replace(/```json/g, '').replace(/```/g, '').trim();

          let productData;
          try {
            productData = JSON.parse(content);
          } catch (parseError) {
            console.error("❌ JSON Parse Failed. Content was:", content);
            throw new Error("Failed to parse AI response as JSON");
          }

          // --- NUEVO: Búsqueda de Imagen en Google posterior al análisis ---
          // Si la IA nos da nombre o marca, intentamos buscar una foto "bonita" en Google
          // en lugar de devolver la foto de la etiqueta (que suele ser fea/borrosa).
          if (productData && productData.name) {
            // 1. ESTRATEGIA SECUENCIAL: INTENTO 1 - PRECISIÓN (ART code)
            let googleImage = null;

            if (productData.reference) {
              let preciseQuery = "";
              // Si tenemos marca, mejor (Adidas KT0463), si no, Nombre + KT0463
              if (productData.brand && productData.brand !== 'Unknown') {
                preciseQuery = `${productData.brand} ${productData.reference}`;
              } else {
                preciseQuery = `${productData.name} ${productData.reference}`;
              }

              console.log(`🎯 Attempting Precision Search (ART): ${preciseQuery}`);
              // NO incluimos color para ser estrictos con el código modelo
              googleImage = await searchImageOnGoogle(preciseQuery);
            }

            // 2. FALLBACK: INTENTO 2 - DETALLE (Si falló el código ART o no existía)
            if (!googleImage) {
              console.log('⚠️ Precision search failed (or no ART). Switching to detailed fallback...');

              let fallbackQuery = productData.name;
              if (productData.brand && productData.brand !== 'Unknown') {
                fallbackQuery = `${productData.brand} ${productData.name}`;
              }

              // En el fallback usamos todo para intentar acertar visualmente
              if (productData.color) {
                fallbackQuery += ` ${productData.color}`;
              }
              if (productData.gender && productData.gender !== 'Unisex') {
                fallbackQuery += ` ${productData.gender}`;
              }

              // Limitar
              fallbackQuery = fallbackQuery.substring(0, 100);
              console.log(`🔍 Attempting Fallback Search: ${fallbackQuery}`);
              googleImage = await searchImageOnGoogle(fallbackQuery);
            }

            if (googleImage) {
              console.log(`📸 Google Image Found: ${googleImage}`);
              productData.image = googleImage;
              productData.source = 'llama4_vision + google_search';
            } else {
              console.log('❌ No Google Image found after all attempts.');
            }
          }

          return new Response(
            JSON.stringify(productData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          throw new Error("No analysis returned from AI (Empty choices)");
        }
      } catch (e) {
        console.error("Vision Analysis Critical Error:", e);
        // RETURNING 200 TO DEBUG CLIENT SIDE (Supabase client hides body on 500)
        return new Response(JSON.stringify({
          error: `DEBUG_ERROR: ${e.message}`,
          step: 'AI_PROCESSING',
          details: JSON.stringify(e)
        }), { status: 200, headers: corsHeaders });
      }
    }

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Missing barcode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


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
      if (code === barcode) {
        foundProduct = await lookupGoogleImages(code);
        if (foundProduct) break;
      }

      // --- 4. BarcodeLookup (Premium - Panic Button) ---
      foundProduct = await lookupBarcodeLookup(code);
      if (foundProduct) break;
    }

    // --- 5. Qwen AI (Groq) - Ultimate Fallback (Inteligencia Artificial) ---
    if (!foundProduct) {
      console.log("⚠️ All traditional sources failed. Asking Qwen AI...");
      // Usamos la API Key proporcionada por el usuario (Idealmente esto iría en Deno.env)
      const groqApiKey = Deno.env.get('GROQ_API_KEY');

      if (groqApiKey) {
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: "qwen-2.5-32b", // Ajustado a un nombre de modelo común en Groq (o intentamos el del usuario si falla este)
              // model: "qwen/qwen3-32b", // Nota: Groq suele usar IDs sin barra, ej: "llama3-..."
              messages: [
                {
                  role: "system",
                  content: "You are a product database assistant. You will receive a barcode number. Your task is to identify the product and return a JSON object with: { name, brand, description, category }. If you don't know it with high confidence, return null. Output strictly JSON."
                },
                {
                  role: "user",
                  content: `Identify the product with barcode: ${barcode}`
                }
              ],
              temperature: 0.1
            })
          });

          const data = await response.json();
          if (data.choices && data.choices.length > 0) {
            const content = data.choices[0].message.content;
            try {
              // Intentar parsear el JSON que devuelve la IA
              const aiProduct = JSON.parse(content);
              if (aiProduct && aiProduct.name) {
                foundProduct = {
                  name: aiProduct.name,
                  brand: aiProduct.brand || 'Unknown',
                  description: aiProduct.description,
                  category: aiProduct.category,
                  image: null, // Qwen text-only no puede ver ni generar imágenes
                  source: 'qwen_ai_groq' // Marcamos que vino de la IA
                };
                console.log("✅ Qwen AI identified the product!");
              }
            } catch (e) {
              console.error("Failed to parse Qwen AI JSON response:", content);
            }
          }
        } catch (err) {
          console.error("Qwen AI API Error:", err);
        }
      }
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
