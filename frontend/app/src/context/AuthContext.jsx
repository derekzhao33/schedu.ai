import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:3001/api';

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
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Call backend API
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store user data and token
      const userData = {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
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
      if (!firstName || !lastName || !email || !password) {
        throw new Error('All fields are required');
      }

      // Call backend API to create user
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // After successful signup, automatically log the user in
      const userData = {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
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

  const updateProfile = async (updates) => {
    setError(null);
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      // Only include fields that are provided (changed fields)
      const updateData = {};
      if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
      if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
      if (updates.email !== undefined) updateData.email = updates.email;

      // If no fields to update, return current user
      if (Object.keys(updateData).length === 0) {
        return user;
      }

      // Call backend API to update user
      const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Update failed');
      }

      const updatedUser = {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
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

      // Call backend API to update password
      const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Password change failed');
      }

      // Note: We don't store password in localStorage for security
      return user;
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
