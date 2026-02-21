import React from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
    showCancel?: boolean;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

export function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    showCancel = false,
    onConfirm,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel'
}: AlertModalProps) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="w-6 h-6 text-emerald-400" />;
            case 'error': return <AlertCircle className="w-6 h-6 text-red-400" />;
            default: return <Info className="w-6 h-6 text-blue-400" />;
        }
    };

    const getColorClass = () => {
        switch (type) {
            case 'success': return 'border-emerald-500/50 bg-emerald-500/10';
            case 'error': return 'border-red-500/50 bg-red-500/10';
            default: return 'border-blue-500/50 bg-blue-500/10';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${getColorClass()}`}>
                            {getIcon()}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{message}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="bg-slate-950 p-4 flex justify-end gap-3">
                    {showCancel && (
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors border border-slate-700"
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-2 text-white rounded-lg font-medium transition-colors ${type === 'error' ? 'bg-red-600 hover:bg-red-500' :
                            type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' :
                                'bg-violet-600 hover:bg-violet-500'
                            }`}
                    >
                        {showCancel ? confirmLabel : 'Close'}
                    </button>
                </div>
            </div>
        </div >
    );
}
