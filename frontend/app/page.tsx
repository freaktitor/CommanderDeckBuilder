'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileUpload } from '@/components/FileUpload';
import { CollectionCard } from '@/lib/types';
import { Package } from 'lucide-react';

import { API_BASE_URL } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCollection, setHasCollection] = useState(false);

  // Check if collection exists
  useEffect(() => {
    const checkCollection = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/collection`);
        if (res.ok) {
          const data = await res.json();
          setHasCollection(data.collection && data.collection.length > 0);
        }
      } catch (e) {
        console.error('Failed to check collection', e);
      }
    };
    checkCollection();
  }, []);

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      if (data.success) {
        router.push('/collection');
      } else {
        throw new Error('Upload failed');
      }

    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
            Commander Builder
          </h1>
          <p className="text-slate-400 text-lg">
            Upload your Manabox collection and start brewing.
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <FileUpload onUpload={handleUpload} isLoading={isLoading} />

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {hasCollection && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 text-center mb-3">
                Already have a collection?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push('/collection')}
                  className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Package className="w-4 h-4" />
                  View Collection
                </button>
                <button
                  onClick={() => router.push('/builder')}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                >
                  Build Deck
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-12 flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-800/50 shadow-lg hover:border-violet-500/30 transition-colors">
          <div className="w-8 h-8 relative rounded-full overflow-hidden bg-slate-800">
            <img
              src="/trashpanda.png"
              alt="Trashpanda"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-slate-400 text-sm font-medium">
            Imagined and created by <span className="text-violet-400">Trashpanda</span> using <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-bold">Gemini 3</span> and <span className="text-indigo-400 font-bold">Antigravity</span>
          </span>
        </div>
      </div>
    </main>
  );
}
