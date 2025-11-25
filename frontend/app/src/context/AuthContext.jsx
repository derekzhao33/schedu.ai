import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  // Check if user is already logged in (from localStorage)
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Error parsing saved user:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      // For now, accept any login without database
      // In production, this would verify against backend
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const userData = { 
        email, 
        password,
        id: Date.now(),
        first_name: email.split('@')[0],
        last_name: 'User'
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', 'bearer-' + userData.id);
      
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (firstName, lastName, email, password) => {
    setError(null);
    setLoading(true);
    try {
      // For now, store user in localStorage without database
      // In production, this would create user in backend database
      if (!firstName || !lastName || !email || !password) {
        throw new Error('All fields are required');
      }

      const userData = { 
        id: Date.now(),
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', 'bearer-' + userData.id);
      
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (firstName, lastName, email) => {
    setError(null);
    try {
      const updatedUser = {
        ...user,
        first_name: firstName,
        last_name: lastName,
        email,
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      setError(errorMessage);
      throw err;
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    setError(null);
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      if (user.password !== oldPassword) {
        throw new Error('Current password is incorrect');
      }

      const updatedUser = {
        ...user,
        password: newPassword,
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password change failed';
      setError(errorMessage);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, error, login, signup, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
