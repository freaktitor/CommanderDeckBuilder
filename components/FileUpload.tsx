'use client';

import { useState, useCallback } from 'react';
import { Upload, Loader2, FileText } from 'lucide-react';

interface FileUploadProps {
    onUpload: (file: File) => void;
    isLoading?: boolean;
}

export function FileUpload({ onUpload, isLoading }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onUpload(e.dataTransfer.files[0]);
        }
    }, [onUpload]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    }, [onUpload]);

    return (
        <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ease-in-out
        ${isDragging
                    ? 'border-violet-500 bg-violet-50/10 scale-[1.02]'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'
                }
      `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleChange}
                accept=".csv,.txt"
                disabled={isLoading}
            />

            <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`p-4 rounded-full ${isDragging ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-slate-400'}`}>
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                        <Upload className="w-8 h-8" />
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-lg font-medium text-slate-200">
                        {isLoading ? 'Processing Collection...' : 'Drop your Manabox CSV or TXT here'}
                    </p>
                    <p className="text-sm text-slate-500">
                        or click to browse
                    </p>
                </div>
                {!isLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                        <FileText className="w-3 h-3" />
                        <span>Supported formats: .csv, .txt</span>
                    </div>
                )}
            </div>
        </div>
    );
}
