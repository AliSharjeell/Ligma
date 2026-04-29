'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

const BRAND_COLOR = '#50B5FF';

type AuthMode = 'login' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    if (mode === 'login') {
      const result = signIn(username, password);
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } else {
      const result = signUp(username, password);
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to create account');
      }
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div
        className="hidden md:flex md:w-1/2 bg-cover bg-center flex-col justify-center items-center p-12 text-white relative"
        style={{
          backgroundImage: 'url(/pexels-michael-spadoni-269949-813465.jpg)',
          filter: 'saturate(1.2)'
        }}
      >
        <div className="max-w-md text-center">
          <h1
            className="text-6xl font-bold mb-4 tracking-tight"
            style={{
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              fontFamily: 'var(--font-lora), serif'
            }}
          >
            Ligma
          </h1>
          <p
            className="text-xl text-white"
            style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.5)' }}
          >
            Real-time Collaborative Canvas
          </p>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <h1
              className="text-4xl font-bold mb-2"
              style={{ color: BRAND_COLOR, fontFamily: 'var(--font-lora), serif' }}
            >
              Ligma
            </h1>
            <p className="text-gray-500">Real-time Collaborative Canvas</p>
          </div>

          {/* Form Header */}
          <div className="text-center mb-8">
            <h2
              className="text-3xl font-bold mb-2"
              style={{ color: '#1f2937' }}
            >
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-gray-500">
              {mode === 'login'
                ? 'Sign in to continue to Ligma'
                : 'Sign up to get started with Ligma'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="Enter your username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-2 outline-none transition"
                style={
                  {
                    '--tw-ring-color': BRAND_COLOR,
                    '--tw-ring-offset-color': '#fff',
                    '--tw-border-color': BRAND_COLOR,
                  } as React.CSSProperties
                }
              />
              {mode === 'signup' && username.length > 0 && username.length < 3 && (
                <p className="text-xs text-amber-600 mt-1">
                  Username must be at least 3 characters
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-2 outline-none transition"
                style={
                  {
                    '--tw-ring-color': BRAND_COLOR,
                    '--tw-ring-offset-color': '#fff',
                    '--tw-border-color': BRAND_COLOR,
                  } as React.CSSProperties
                }
              />
              {mode === 'signup' && password.length > 0 && password.length < 4 && (
                <p className="text-xs text-amber-600 mt-1">
                  Password must be at least 4 characters
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full px-4 py-3 text-white rounded-lg transition hover:opacity-90 font-medium"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              {mode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          {/* Toggle Mode Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
              <button
                onClick={toggleMode}
                className="font-medium hover:underline"
                style={{ color: BRAND_COLOR }}
              >
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
