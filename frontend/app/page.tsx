'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { FileUpload } from '@/components/FileUpload';
import { CollectionCard } from '@/lib/types';
import { Package, LogIn, LogOut } from 'lucide-react';

import { API_BASE_URL } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCollection, setHasCollection] = useState(false);

  // Check if collection exists and redirect if logged in
  useEffect(() => {
    const checkCollection = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/collection`);
        if (res.ok) {
          const data = await res.json();
          const exists = data.collection && data.collection.length > 0;
          setHasCollection(exists);

          // Auto-redirect if logged in and has data
          if (session && exists) {
            router.push('/collection');
          }
        }
      } catch (e) {
        console.error('Failed to check collection', e);
      }
    };
    checkCollection();
  }, [session, router]);

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

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-8">
          {/* Auth Section */}
          <div className="text-center space-y-4">
            {session ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 p-2 pr-4 bg-slate-800/50 rounded-full border border-slate-700">
                    {session.user?.image && (
                      <img
                        src={session.user.image}
                        alt={session.user.name || ''}
                        className="w-8 h-8 rounded-full border border-violet-500/50"
                      />
                    )}
                    <span className="text-sm font-medium text-slate-200">
                      {session.user?.name}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="p-2.5 bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-full border border-slate-700 transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                {!hasCollection && !isLoading ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-2xl font-bold text-white">Welcome to the Command Center!</h2>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto">
                      To start building decks, you'll need to import your collection. Upload your Manabox file below to sync your cards with your account.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => router.push('/builder')}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-violet-500/20 active:scale-[0.98]"
                  >
                    Go to Deck Builder
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Get Started</p>
                <button
                  onClick={() => signIn('google')}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-950 px-6 py-3 rounded-xl font-bold transition-all active:scale-[0.98]"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  Continue with Google
                </button>
              </div>
            )}
          </div>

          {/* Divider (Only show if not logged in) */}
          {!session && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900/10 backdrop-blur-sm px-2 text-slate-500 font-medium uppercase tracking-widest">Or Use as Guest</span>
              </div>
            </div>
          )}

          {/* Upload Section (Always show if no collection, or show specifically for first-time) */}
          {(!hasCollection || !session) && (
            <div className="space-y-4">
              <FileUpload onUpload={handleUpload} isLoading={isLoading} />

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* No persistent buttons for anonymous guests - forcing an upload flow as per user request */}
          {session && hasCollection && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={() => router.push('/collection')}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                <Package className="w-4 h-4" />
                View Full Collection
              </button>
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
