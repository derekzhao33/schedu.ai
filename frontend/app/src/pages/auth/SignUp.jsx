import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../context/AuthContext';
import FlowifyLogo from '../../components/FlowifyLogo';

const SignUp = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signup(firstName, lastName, email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <div className="flex h-[100vh] w-full">
      {/* Left Side - Logo */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-50 to-blue-100 items-center justify-center">
        <div className="text-center">
          <FlowifyLogo size="lg" />
          <p className="text-gray-600 text-lg mt-6">Your intelligent scheduling assistant</p>
        </div>
      </div>

      {/* Right Side - Sign Up Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-8">
          {/* Logo for mobile */}
          <div className="lg:hidden flex justify-center">
            <FlowifyLogo size="sm" />
          </div>

          {/* Sign Up Form */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold text-gray-900">Create account</h2>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                  {error}
                </div>
              )}
              {/* First Name and Last Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full ${
                    confirmPassword && password && confirmPassword !== password
                      ? 'border-red-500 focus-visible:ring-red-500'
                      : confirmPassword && password && confirmPassword === password
                      ? 'border-green-500 focus-visible:ring-green-500'
                      : ''
                  }`}
                />
                {confirmPassword && password && confirmPassword !== password && (
                  <p className="text-sm text-red-500">Passwords do not match</p>
                )}
                {confirmPassword && password && confirmPassword === password && (
                  <p className="text-sm text-green-600">Passwords match</p>
                )}
              </div>

              {/* Sign Up Button */}
              <Button 
                onClick={handleSignUp}
                disabled={loading}
                className="w-full bg-[#181D27] hover:bg-[#2a3142] text-white font-medium py-6 text-base hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Sign up'}
              </Button>

              {/* Login Link */}
              <div className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={handleLogin}
                  className="font-medium text-[#181D27] hover:text-[#5b6ee1] underline hover:cursor-pointer"
                >
                  Log in here
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;