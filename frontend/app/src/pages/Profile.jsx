import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Camera, Mail, User, Lock, Link2 } from 'lucide-react';

const Profile = () => {
  // Profile state
  const [firstName, setFirstName] = useState('John');
  const [lastName, setLastName] = useState('Doe');
  const [username, setUsername] = useState('johndoe');
  const [email, setEmail] = useState('john@example.com');
  const [profileImage, setProfileImage] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleSaveProfile = () => {
    // Save profile functionality will go here
  };

  const handleChangePassword = () => {
    // Change password functionality will go here
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

  const NavLink = ({ children, active = false }) => (
    <div className={`text-gray-300 hover:text-white transition cursor-pointer py-2 px-4 rounded-lg ${active ? 'bg-gray-700' : ''}`}>
      {children}
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#E0E7FF' }}>
      {/* Sidebar */}
      <aside className="w-64 p-6 shadow-xl rounded-r-3xl hidden md:block" style={{ backgroundColor: '#181D27' }}>
        <h2 className="text-xl font-bold mb-6 text-white">Schedu.ai</h2>
        <ul className="space-y-2">
          <li><NavLink>Dashboard</NavLink></li>
          <li><NavLink>Calendar</NavLink></li>
          <li><NavLink>Tasks</NavLink></li>
          <li><NavLink>Assistant</NavLink></li>
          <li><NavLink>Stats</NavLink></li>
          <li><NavLink active>Profile</NavLink></li>
        </ul>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 space-y-8 w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#181D27' }}>Profile Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account information and preferences</p>
        </div>

        {/* Profile Information Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Profile Information</CardTitle>
            <CardDescription>Update your personal details and profile picture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Picture */}
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profileImage} />
                <AvatarFallback className="text-2xl" style={{ backgroundColor: '#181D27', color: 'white' }}>
                  {firstName[0]}{lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="picture" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition">
                    <Camera className="h-5 w-5 text-gray-600" />
                    <span className="text-sm text-gray-700">Upload Photo</span>
                  </div>
                  <Input
                    id="picture"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </Label>
                <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF. Max 5MB.</p>
              </div>
            </div>

            <Separator />

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

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="pl-10"
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

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSaveProfile}
                className="bg-[#181D27] hover:bg-[#2a3142] text-white font-medium cursor-pointer"
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
                className="bg-[#181D27] hover:bg-[#2a3142] text-white font-medium cursor-pointer"
              >
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Connected Accounts Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Link2 className="h-6 w-6" />
              Connected Accounts
            </CardTitle>
            <CardDescription>Manage your calendar integrations and connected services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Calendar */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-600 font-semibold">G</span>
                </div>
                <div>
                  <p className="font-semibold">Google Calendar</p>
                  <p className="text-sm text-gray-500">Sync your Google Calendar events</p>
                </div>
              </div>
              <Button
                onClick={handleConnectGoogle}
                variant="outline"
                className="hover:cursor-pointer"
              >
                Connect
              </Button>
            </div>

            {/* Outlook Calendar */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">O</span>
                </div>
                <div>
                  <p className="font-semibold">Outlook Calendar</p>
                  <p className="text-sm text-gray-500">Sync your Outlook Calendar events</p>
                </div>
              </div>
              <Button
                onClick={handleConnectOutlook}
                variant="outline"
                className="hover:cursor-pointer"
              >
                Connect
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;