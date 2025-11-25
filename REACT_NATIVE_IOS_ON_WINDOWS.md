# Building React Native iOS Apps on Windows 10

## Can You Build iOS Apps on Windows 10?

Yes, you can build React Native apps for iOS using Expo on Windows 10, but with some important limitations.

## What You CAN Do

- ✅ Develop and test your React Native app on Windows using Expo
- ✅ Build and deploy to Android without any issues
- ✅ Use Expo's cloud build service to compile for iOS (no local Mac needed)
- ✅ Test iOS builds on your iPhone using the Expo Go app during development
- ✅ Build production iOS apps without owning a Mac (using EAS Build)

## What You CANNOT Do Locally

- ❌ Build the final iOS app locally on Windows without a Mac
- ❌ Use native iOS modules that require Xcode compilation
- ❌ Submit to the App Store directly from Windows (you'll need a Mac for final submission)

## Recommended Workflow

### 1. Develop on Windows
Use Expo CLI and test with Expo Go app on your phone

### 2. Build for iOS
Use `eas build` (Expo's cloud build service) - it compiles in the cloud, so you don't need a Mac

### 3. Submit
You'll need access to a Mac (or use someone else's) to submit to the App Store, but the app file itself is built in the cloud

## Setup Steps

```bash
# Install Expo CLI globally
npm install -g expo-cli

# Create a new Expo project
expo init my-app
cd my-app

# Build for iOS using cloud build
eas build --platform ios

# Or build for both platforms
eas build --platform all
```

## Why This Works

The **Expo Managed Workflow** handles all the native iOS compilation remotely through EAS (Expo Application Services). You won't hit the "need a Mac" limitation unless you:
- Need to eject from Expo
- Use native modules that require native compilation
- Need to submit directly to the App Store (but you can use a Mac for just this step)

## Key Benefits

- **No Xcode required** on Windows
- **Cross-platform development** from Windows
- **Cloud compilation** for iOS
- **Faster development cycle** with hot reload
- **Automatic native module handling** in most cases

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)
- [React Native on Windows](https://microsoft.github.io/react-native-windows/)
