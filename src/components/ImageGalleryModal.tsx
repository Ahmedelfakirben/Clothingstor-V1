import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ImageGalleryModalProps {
    mainImage?: string | null;
    galleryImages: Array<{ image_url: string }>;
    onClose: () => void;
    title?: string;
}

export function ImageGalleryModal({ mainImage, galleryImages, onClose, title }: ImageGalleryModalProps) {
    const { t } = useLanguage();
    // Combine all images into one flat array of URLs
    const allImages: string[] = [];
    if (mainImage) allImages.push(mainImage);
    galleryImages.forEach(img => {
        if (img.image_url && img.image_url !== mainImage) {
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

    if (allImages.length === 0) return null;

    return (
        <div
            className="fixed inset-0 bg-black/90 flex flex-col z-[100]"
            onClick={onClose}
        >
            <div className="flex justify-between items-center p-4 text-white absolute top-0 w-full z-10 bg-gradient-to-b from-black/50 to-transparent">
                <h3 className="font-medium text-lg truncate shadow-sm">{title || t('products.gallery')}</h3>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex-1 relative flex items-center justify-center p-4 pt-16 group">
                {allImages.length > 1 && (
                    <button
                        onClick={handlePrevious}
                        className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all opacity-0 lg:opacity-100 group-hover:opacity-100 focus:opacity-100 z-10"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}

                <img
                    src={allImages[currentIndex]}
                    alt={`Imagen ${currentIndex + 1}`}
                    className="max-h-full max-w-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                />

                {allImages.length > 1 && (
                    <button
                        onClick={handleNext}
                        className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/80 transition-all opacity-0 lg:opacity-100 group-hover:opacity-100 focus:opacity-100 z-10"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}
            </div>

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
