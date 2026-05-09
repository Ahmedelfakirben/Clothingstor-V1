import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Share2, MessageCircle, Mail, Copy, Check, ExternalLink } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { supabase } from '../lib/supabase';
import { Product, ProductSize } from '../types/supabase';
import { toast } from 'react-hot-toast';

interface ImageGalleryModalProps {
    product: Product;
    productSizes: ProductSize[];
    galleryImages: Array<{ image_url: string }>;
    onClose: () => void;
}

export function ImageGalleryModal({ product, productSizes, galleryImages, onClose }: ImageGalleryModalProps) {
    const { t } = useLanguage();
    const { formatCurrency } = useCurrency();
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [copied, setCopied] = useState(false);

    // Combine all images into one flat array of URLs
    const allImages: string[] = [];
    if (product.image_url) allImages.push(product.image_url);
    galleryImages.forEach(img => {
        if (img.image_url && img.image_url !== product.image_url) {
            allImages.push(img.image_url);
        }
    });

    const [currentIndex, setCurrentIndex] = useState(0);

    const handlePrevious = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    };

    // Prevent background scrolling
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
            if (e.key === 'ArrowRight') setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, allImages.length]);

    const [companyInfo, setCompanyInfo] = useState<{name: string, phone: string, address: string} | null>(null);

    // Fetch company info for sharing
    useEffect(() => {
        const fetchCompany = async () => {
            const { data } = await supabase.from('company_settings').select('company_name, phone, address').single();
            if (data) {
                setCompanyInfo({
                    name: data.company_name || '',
                    phone: data.phone || '',
                    address: data.address || ''
                });
            }
        };
        fetchCompany();
    }, []);

    const getShareText = () => {
        const mainImageUrl = allImages[0] || '';
        
        const sizesText = productSizes.length > 0 
            ? `\n${t('pos.sizes') || 'Tallas'}: ${productSizes.map(s => s.size_name).join(', ')}`
            : '';
        
        const priceText = `\n${t('pos.price') || 'Precio'}: ${formatCurrency(product.base_price)}`;
        
        const descriptionText = product.description ? `\n${product.description}` : '';

        const storeInfoText = companyInfo ? 
            `\n\n--- ${companyInfo.name} ---\n${companyInfo.address}\nTel: ${companyInfo.phone}\nInstagram: https://www.instagram.com/shopping__by__lina/` : '';

        // Put main image URL first for better preview in WhatsApp
        return `${mainImageUrl}\n\n*${product.name.toUpperCase()}*${descriptionText}${sizesText}${priceText}${storeInfoText}`;
    };

    const handleWhatsAppShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = encodeURIComponent(getShareText());
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const handleEmailShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const subject = encodeURIComponent(`${t('Producto') || 'Produit'}: ${product.name}`);
        const body = encodeURIComponent(getShareText().replace(/\*/g, '')); // Remove markdown for email
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };


    const handleSystemShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareData = {
            title: product.name,
            text: getShareText().replace(/\*/g, ''),
            url: allImages[0]
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            handleCopyShare(e);
        }
    };

    const handleCopyShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = getShareText().replace(/\*/g, '');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            toast.success(t('Copiado al portapapeles'));
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (allImages.length === 0 && !product) return null;

    return (
        <div
            className="fixed inset-0 bg-black/95 flex flex-col z-[100] overflow-hidden"
            onClick={onClose}
        >
            {/* Header with Close and Share */}
            <div className="flex justify-between items-center p-4 text-white absolute top-0 w-full z-20 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center gap-4 flex-1 truncate">
                    <h3 className="font-semibold text-lg truncate shadow-sm">{product.name}</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowShareOptions(!showShareOptions); }}
                            className={`p-2 rounded-full transition-all flex items-center gap-2 ${
                                showShareOptions ? 'bg-amber-500 text-white' : 'bg-white/10 hover:bg-white/20'
                            }`}
                        >
                            <Share2 className="w-5 h-5" />
                            <span className="text-xs font-bold hidden sm:inline">{t('Compartir') || 'Partager'}</span>
                        </button>
                    </div>
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors ml-2"
                >
                    <X className="w-8 h-8" />
                </button>
            </div>

            {/* Share Options Overlay */}
            {showShareOptions && (
                <div 
                    className="absolute top-20 left-4 z-30 bg-white rounded-2xl shadow-2xl p-2 flex flex-col gap-1 min-w-[220px] animate-in slide-in-from-top-4 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button 
                        onClick={handleWhatsAppShare}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-green-600 rounded-xl transition-colors font-bold"
                    >
                        <MessageCircle className="w-5 h-5" />
                        WhatsApp
                    </button>
                    <button 
                        onClick={handleEmailShare}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors font-bold"
                    >
                        <Mail className="w-5 h-5" />
                        Email
                    </button>
                    <button 
                        onClick={handleSystemShare}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 text-amber-600 rounded-xl transition-colors font-bold"
                    >
                        <ExternalLink className="w-5 h-5" />
                        {t('Otras Apps') || 'Autres Apps'}
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <button 
                        onClick={handleCopyShare}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 rounded-xl transition-colors font-bold"
                    >
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        {t('Copiar Info') || 'Copier Info'}
                    </button>
                </div>
            )}

            <div className="flex-1 min-h-0 w-full relative flex items-center justify-center p-4 pt-20 group">
                {allImages.length > 1 && (
                    <button
                        onClick={handlePrevious}
                        className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all opacity-0 lg:opacity-100 group-hover:opacity-100 focus:opacity-100 z-30"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}

                <img
                    src={allImages[currentIndex]}
                    alt={`Imagen ${currentIndex + 1}`}
                    className="max-h-full max-w-full w-auto h-auto object-contain select-none"
                    onClick={(e) => e.stopPropagation()}
                />

                {allImages.length > 1 && (
                    <button
                        onClick={handleNext}
                        className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all opacity-0 lg:opacity-100 group-hover:opacity-100 focus:opacity-100 z-30"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
                <div className="p-4 bg-gradient-to-t from-black/50 to-transparent">
                    <div className="flex justify-center gap-2 overflow-x-auto py-2 scrollbar-none">
                        {allImages.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                                className={`relative h-16 w-16 flex-shrink-0 cursor-pointer rounded-md overflow-hidden transition-all ${idx === currentIndex ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'
                                    }`}
                            >
                                <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
