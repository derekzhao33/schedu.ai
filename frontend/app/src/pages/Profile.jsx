import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useThemeSettings } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Sidebar, { useSidebar } from '../components/Sidebar';
import { Camera, Mail, User, Lock, Link2, Crown, Calendar } from 'lucide-react';

const Profile = () => {
  const { theme } = useThemeSettings();
  const { isCollapsed } = useSidebar();
  const { user, updateProfile } = useAuth();

  // Profile state - load from user
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileImage, setProfileImage] = useState('');
  const [profileMessage, setProfileMessage] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Subscription state
  const [subscriptionType, setSubscriptionType] = useState('free-trial'); // 'free-trial' or 'premium'
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(14);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  const handleChangePassword = () => {
    // Change password functionality will go here
  };

  const handleSaveProfile = async () => {
    try {
      // Only send fields that have changed
      const updates = {};
      if (firstName !== user?.first_name) updates.firstName = firstName;
      if (lastName !== user?.last_name) updates.lastName = lastName;
      if (email !== user?.email) updates.email = email;

      // If nothing changed, don't make API call
      if (Object.keys(updates).length === 0) {
        setProfileMessage('No changes to save');
        setTimeout(() => setProfileMessage(''), 3000);
        return;
      }

      await updateProfile(updates);
      setProfileMessage('Profile updated successfully!');
      setTimeout(() => setProfileMessage(''), 3000);
    } catch (error) {
      setProfileMessage('Error updating profile: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleImageUpload = (e) => {
    // Image upload functionality will go here
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnectGoogle = () => {
    // Connect Google account
  };

  const handleConnectOutlook = () => {
    // Connect Outlook account
  };

  const handleSubscribe = () => {
    // Subscription purchase logic will go here
    console.log('Subscribe clicked');
    setShowSubscriptionDialog(false);
  };

  return (
    <div className={`flex min-h-screen ${theme === 'dark' ? 'dark' : ''}`} style={{ backgroundColor: '#F7F8FC' }}>
      <Sidebar />

      {/* Main content */}
      <main className={`flex-1 p-8 space-y-8 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#355C7D] to-[#725A7A] bg-clip-text text-transparent">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account information and preferences</p>
        </div>

        {/* Profile Information Card */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-2xl">Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </div>
            {/* Subscription Card in Header */}
            <Card 
              className="border-2 cursor-pointer hover:shadow-md transition-shadow flex-shrink-0"
              style={{ 
                borderColor: subscriptionType === 'free-trial' ? '#FF7582' : '#355C7D',
                backgroundColor: subscriptionType === 'free-trial' ? '#FFF5F6' : '#F0F4FF',
                minWidth: '320px'
              }}
              onClick={() => setShowSubscriptionDialog(true)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {subscriptionType === 'free-trial' ? (
                      <Calendar className="h-5 w-5 flex-shrink-0" style={{ color: '#FF7582' }} />
                    ) : (
                      <Crown className="h-5 w-5 flex-shrink-0" style={{ color: '#355C7D' }} />
                    )}
                    <div>
                      <p className="font-semibold text-sm">
                        {subscriptionType === 'free-trial' ? 'Free Trial' : 'Premium Subscription'}
                      </p>
                      {subscriptionType === 'free-trial' && (
                        <p className="text-xs text-gray-600">
                          {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
                        </p>
                      )}
                      {subscriptionType === 'premium' && (
                        <p className="text-xs text-gray-600">Active</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="flex-shrink-0"
                    style={{ 
                      background: subscriptionType === 'free-trial' 
                        ? 'linear-gradient(to right, #FF7582, #C56C86)' 
                        : 'linear-gradient(to right, #355C7D, #725A7A)',
                      color: 'white'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubscriptionDialog(true);
                    }}
                  >
                    {subscriptionType === 'free-trial' ? 'Upgrade Now' : 'Manage'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Fields */}
            <div className="space-y-4">
                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

            {/* Profile Message */}
            {profileMessage && (
              <div className={`p-3 rounded-md text-sm ${profileMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {profileMessage}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSaveProfile}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Lock className="h-6 w-6" />
              Change Password
            </CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                className={`${
                  confirmNewPassword && newPassword && confirmNewPassword !== newPassword
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : confirmNewPassword && newPassword && confirmNewPassword === newPassword
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : ''
                }`}
              />
              {confirmNewPassword && newPassword && confirmNewPassword !== newPassword && (
                <p className="text-sm text-red-500">Passwords do not match</p>
              )}
              {confirmNewPassword && newPassword && confirmNewPassword === newPassword && (
                <p className="text-sm text-green-600">Passwords match</p>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleChangePassword}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Subscription Dialog */}
      <AlertDialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl flex items-center gap-2">
              <Crown className="h-6 w-6" style={{ color: '#FF7582' }} />
              Upgrade to Premium
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-4">
              Get unlimited access to all features with our annual subscription.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-6">
            <div className="border-2 rounded-lg p-6 text-center" style={{ borderColor: '#FF7582', backgroundColor: '#FFF5F6' }}>
              <p className="text-sm text-gray-600 mb-2">Annual Plan</p>
              <div className="flex items-baseline justify-center gap-1 mb-3">
                <span className="text-4xl font-bold" style={{ color: '#355C7D' }}>$20</span>
                <span className="text-gray-600">/year</span>
              </div>
              <ul className="text-sm text-left space-y-2 text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Unlimited calendar events
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  AI-powered scheduling assistant
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Advanced integrations
                </li>
              </ul>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubscribe}
              className="bg-gradient-to-r from-[#FF7582] to-[#C56C86] hover:opacity-90 text-white"
            >
              Subscribe Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;