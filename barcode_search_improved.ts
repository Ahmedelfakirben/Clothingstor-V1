const fetchBarcodeFromAPI = async (barcode: string) => {
    try {
        const GOOGLE_API_KEY = 'AIzaSyBKkl3omP4BgmZh_TMCFWtQ9SZEF56oh8I';
        const SEARCH_ENGINE_ID = '944d5e8d54aad4342';

        // Lógica de retry: Probar con 13 dígitos y luego con 12 (sin el 0 inicial)
        const codigosAProbar: string[] = [barcode];

        // Si tiene 13 dígitos y empieza por 0, probar también sin el 0 (UPC-12)
        if (barcode.length === 13 && barcode.startsWith('0')) {
            codigosAProbar.push(barcode.slice(1));
        }

        // Intentar con cada código
        for (const codigo of codigosAProbar) {
            console.log(`🔍 Buscando en Google: ${codigo} (${codigo.length} dígitos)`);

            const response = await fetch(
                `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(codigo)}&num=1`
            );

            console.log(`📡 Respuesta (${codigo}):`, response.status);

            if (!response.ok) {
                console.error(`❌ Error para ${codigo}:`, response.statusText);
                continue; // Probar con el siguiente código
            }

            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                console.log(`✅ Encontrado con código ${codigo}`);

                // Extracción segura de imagen
                let imageUrl: string | null = null;
                if (item.pagemap?.cse_image?.[0]?.src) {
                    imageUrl = item.pagemap.cse_image[0].src;
                } else if (item.pagemap?.cse_thumbnail?.[0]?.src) {
                    imageUrl = item.pagemap.cse_thumbnail[0].src;
                }

                // Extraer marca
                let brand = 'Unknown';
                const link = item.link.toLowerCase();
                if (link.includes('amazon')) brand = 'Amazon';
                else if (link.includes('zara')) brand = 'Zara';
                else if (link.includes('hm.com')) brand = 'H&M';
                else if (link.includes('zalando')) brand = 'Zalando';
                else if (link.includes('shein')) brand = 'Shein';

                return {
                    name: item.title,
                    brand: brand,
                    description: item.snippet,
                    category: 'Clothing',
                    image: imageUrl
                };
            }
        }

        console.warn('❌ No encontrado con ningún formato');
        return null;

    } catch (error) {
        console.error('💥 Error:', error);
        return null;
    }
};
