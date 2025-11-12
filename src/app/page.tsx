'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginForm from '@/components/customer/LoginForm';
import RegisterForm from '@/components/customer/RegisterForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { UtensilsCrossedIcon, ClockIcon, MapPinIcon, StarIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  if (isAuthenticated) {
    // TODO: Redirect to appropriate dashboard based on user role
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome back!</h1>
          <p className="text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <UtensilsCrossedIcon className="h-8 w-8 text-orange-600" />
              <span className="text-xl font-bold text-gray-900">Restaurant Hub</span>
            </div>
            <nav className="flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-orange-600 transition-colors">
                Features
              </a>
              <a href="#about" className="text-gray-700 hover:text-orange-600 transition-colors">
                About
              </a>
              <a href="#contact" className="text-gray-700 hover:text-orange-600 transition-colors">
                Contact
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-orange-600 to-red-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-6xl font-bold mb-6">
                Delicious Food,
                <br />
                Delivered Fast
              </h1>
              <p className="text-xl mb-8 text-orange-100">
                Order your favorite meals online, reserve tables, and enjoy a seamless dining experience.
                Join thousands of satisfied customers today!
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setIsLogin(false)}
                  className="px-8 py-3 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
                >
                  Get Started
                </button>
                <button
                  onClick={() => setIsLogin(true)}
                  className="px-8 py-3 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
            <div className="relative">
              <img
                src="/api/placeholder/600/400"
                alt="Delicious food"
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Choose Restaurant Hub?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of dining with our comprehensive restaurant management system
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UtensilsCrossedIcon className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Easy Ordering</h3>
                <p className="text-gray-600">
                  Browse menus, customize orders, and checkout seamlessly in just a few clicks
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClockIcon className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-time Updates</h3>
                <p className="text-gray-600">
                  Track your order status and get instant notifications about your food
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPinIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Table Reservations</h3>
                <p className="text-gray-600">
                  Book your preferred table in advance and skip the waiting lines
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <StarIcon className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Loyalty Rewards</h3>
                <p className="text-gray-600">
                  Earn points with every order and enjoy exclusive member benefits
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Auth Section */}
      {isLogin || !isLogin ? (
        <section className="py-20 bg-gray-100">
          <div className="max-w-md mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">
                  {isLogin ? 'Sign In' : 'Create Account'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLogin ? (
                  <LoginForm
                    onSuccess={() => {/* Handle successful login */}}
                    onToggleMode={() => setIsLogin(!isLogin)}
                  />
                ) : (
                  <RegisterForm
                    onSuccess={() => {/* Handle successful registration */}}
                    onToggleMode={() => setIsLogin(!isLogin)}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <UtensilsCrossedIcon className="h-6 w-6 text-orange-500" />
                <span className="text-lg font-bold">Restaurant Hub</span>
              </div>
              <p className="text-gray-400">
                Your complete restaurant management solution
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Menu</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Reservations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Orders</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Profile</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <p className="text-gray-400 mb-4">
                Stay updated with our latest offers and features
              </p>
              <div className="flex space-x-4">
                {/* Social media icons would go here */}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Restaurant Hub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
