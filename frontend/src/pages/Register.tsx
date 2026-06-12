import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [wsetLevel, setWsetLevel] = useState('L2');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, password, wsetLevel);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-['Playfair_Display'] text-3xl font-bold text-[#722F37] text-center mb-2">
          WSET Chatbot
        </h1>
        <p className="text-[#6B6B6B] text-center mb-8 text-sm">
          Create your study account
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-[#E5E0DA] p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#1A1A1A] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1A1A1A] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37]"
              placeholder="Min. 6 characters"
            />
          </div>

          <div>
            <label htmlFor="level" className="block text-sm font-medium text-[#1A1A1A] mb-1">
              WSET Level
            </label>
            <select
              id="level"
              value={wsetLevel}
              onChange={(e) => setWsetLevel(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37] bg-white"
            >
              <option value="L1">Level 1 — Introduction</option>
              <option value="L2">Level 2 — Intermediate</option>
              <option value="L3">Level 3 — Advanced</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#8B4550] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#6B6B6B] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#722F37] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
