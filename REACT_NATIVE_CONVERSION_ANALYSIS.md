# React to React Native Conversion Analysis

## Overview

This document provides a comprehensive analysis of converting the Schedu.ai React web application to React Native for mobile app development, including what components can be reused and what needs to be rebuilt.

---

## ✅ Fully Reusable (95-100%)

### 1. Business Logic & State Management

- ✅ **Context API** - All three contexts can be reused as-is:
  - `ScheduleContext.jsx` - 100% compatible
  - `ThemeContext.jsx` - Needs minor localStorage adjustments (use AsyncStorage)
  - `ModalContext.jsx` - 100% compatible

- ✅ **Custom Hooks Logic** - Business logic reusable, API calls need adaptation:
  - `useGoogleCalendar` - Core logic stays, fetch calls work the same

### 2. Data Structures & Models

- ✅ Task objects, Event objects, all data structures
- ✅ Date handling with `date-fns` (fully compatible with React Native)
- ✅ API request/response formats

### 3. API Integration Logic

- ✅ All `fetch()` calls work identically in React Native
- ✅ Google Calendar OAuth flow (with minor platform-specific adjustments)
- ✅ AI Assistant API integration

---

## ⚠️ Needs Adaptation (50-80% reusable)

### 1. Navigation & Routing

**Current:** React Router DOM
```jsx
// Web version
import { BrowserRouter, Link, useLocation } from 'react-router-dom';
```

**React Native:** Need React Navigation
```jsx
// React Native version
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
```

**Reusability:** 0% of routing code, but screen components ~70% reusable

### 2. Storage

**Current:** localStorage
```jsx
localStorage.setItem('themeSettings', JSON.stringify(settings));
```

**React Native:** AsyncStorage
```jsx
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('themeSettings', JSON.stringify(settings));
```

**Reusability:** Create abstraction layer, business logic 100% reusable

---

## ❌ Must Rebuild (0-30% reusable)

### 1. UI Components & Styling

**Major Changes Required:**

#### HTML → React Native Components

```jsx
// Web (Won't work in React Native)
<div className="flex">
  <button onClick={...}>Click</button>
  <input type="text" />
</div>

// React Native (Required)
<View style={styles.flex}>
  <TouchableOpacity onPress={...}>
    <Text>Click</Text>
  </TouchableOpacity>
  <TextInput />
</View>
```

#### Tailwind CSS → StyleSheet/NativeWind

Your current setup uses:
- ❌ Tailwind CSS classes (won't work directly)
- ❌ Radix UI (web-only, no mobile version)
- ❌ shadcn/ui (web-only)
- ❌ Framer Motion (limited React Native support)

**Options for React Native:**
1. **NativeWind** - Tailwind for React Native (recommended)
2. **React Native StyleSheet** - Native styling API
3. **Styled Components** - CSS-in-JS library

### 2. Component Libraries to Replace

| Web Library | React Native Alternative | Compatibility |
|------------|-------------------------|---------------|
| Radix UI | React Native Paper / React Native Elements | 0% |
| shadcn/ui | Custom components or RN libraries | 0% |
| Lucide React | react-native-vector-icons | Icons reusable |
| Framer Motion | React Native Reanimated | Different API |
| react-confetti | react-native-confetti-cannon | Similar concept |

### 3. Page Components

Each page needs UI rewrite but logic is reusable:

**Dashboard.jsx** (Lines 1-326)
- ✅ Reusable: State logic, data filtering, greeting function
- ❌ Rebuild: All JSX (div → View, styling, animations)
- Estimate: 30% reusable

**Calendar.jsx**
- ✅ Reusable: Calendar logic, event management, AI parsing
- ❌ Rebuild: Calendar grid UI, date picker
- Use: `react-native-calendars` library
- Estimate: 40% reusable

**Sidebar Component**
- ❌ Complete rebuild needed
- Use: React Navigation Drawer or Bottom Tabs
- Estimate: 10% reusable (just icon references)

---

## 📊 Overall Reusability Breakdown

| Category | Reusability | Notes |
|----------|-------------|-------|
| **State Management** | 95% | Minor AsyncStorage changes |
| **Business Logic** | 90% | Core functions work as-is |
| **API Calls** | 100% | fetch() identical in RN |
| **Data Structures** | 100% | Pure JavaScript |
| **Navigation** | 5% | Complete rewrite needed |
| **UI Components** | 15% | Almost complete rebuild |
| **Styling** | 0-30% | Depends on approach (NativeWind vs StyleSheet) |
| **Third-party Libraries** | 40% | Many need RN alternatives |

**Overall Project Reusability: ~45-50%**

---

## 🛠️ Recommended Conversion Strategy

### Phase 1: Setup Architecture (Week 1)

1. ✅ Copy all Context files unchanged
2. ✅ Create AsyncStorage abstraction layer
3. ✅ Set up React Navigation
4. ✅ Install NativeWind for styling

### Phase 2: Core Screens (Week 2-3)

1. Rebuild Calendar screen with `react-native-calendars`
2. Rebuild Dashboard with native components
3. Rebuild Tasks list with FlatList
4. Create navigation structure

### Phase 3: Features (Week 4)

1. Implement modals with React Native Modal
2. Add animations with Reanimated
3. Integrate Google Calendar OAuth (use libraries like `react-native-app-auth`)
4. Voice input with `@react-native-voice/voice`

### Phase 4: Polish (Week 5)

1. Theme support (dark/light mode)
2. Notifications with `@notifee/react-native`
3. Testing and refinement

---

## 💡 Key Recommendations

### 1. Use NativeWind

Since you're already using Tailwind, NativeWind provides the smoothest transition:
```bash
npm install nativewind
npm install --save-dev tailwindcss
```

### 2. Share Code via Monorepo

Consider a shared package structure:
```
schedu.ai/
├── packages/
│   ├── shared/           # 50% of your code!
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── api/
│   ├── web/             # Current React app
│   └── mobile/          # New React Native app
```

### 3. Component Mapping Guide

| Web Component | React Native | Library |
|--------------|--------------|---------|
| `<div>` | `<View>` | Built-in |
| `<button>` | `<TouchableOpacity>` | Built-in |
| `<input>` | `<TextInput>` | Built-in |
| `<img>` | `<Image>` | Built-in |
| Calendar grid | `<Calendar>` | react-native-calendars |
| Modals | `<Modal>` | Built-in |
| Icons | `<Icon>` | react-native-vector-icons |

### 4. Must-Have React Native Libraries

```json
{
  "dependencies": {
    "@react-navigation/native": "^6.x",
    "@react-navigation/bottom-tabs": "^6.x",
    "@react-native-async-storage/async-storage": "^1.x",
    "react-native-calendars": "^1.x",
    "react-native-vector-icons": "^10.x",
    "nativewind": "^4.x",
    "react-native-reanimated": "^3.x",
    "date-fns": "^4.1.0"  // Already using, no change!
  }
}
```

---

## 🎯 Quick Win: What You Can Copy-Paste Today

1. ✅ `frontend/app/src/context/ScheduleContext.jsx` - Copy as-is
2. ✅ All date-fns utility functions
3. ✅ API endpoint URLs and fetch logic
4. ✅ Task/Event data models
5. ✅ Color schemes and theme definitions (adapt to StyleSheet format)

---

## 📝 Summary

**Yes, you can convert to React Native**, but it's more of a "port" than a "convert":

- **Business logic & state:** ~90% reusable ✅
- **UI & components:** ~15% reusable ❌
- **Overall codebase:** ~45-50% reusable ⚠️

**Estimated effort:** 4-6 weeks for a feature-complete mobile app

**Best approach:** Shared monorepo structure to maximize code reuse and maintain both platforms simultaneously.

---

## 🔄 Current Tech Stack

### Web (React)
- **Framework:** React 19.2.0 with Vite
- **Routing:** React Router DOM v7.9.6
- **Styling:** Tailwind CSS v4.1.17
- **UI Components:** shadcn/ui, Radix UI
- **Animation:** Framer Motion v12.23.24
- **Icons:** Lucide React v0.554.0
- **State:** React Context API
- **Storage:** localStorage
- **Date Utils:** date-fns v4.1.0

### Mobile (React Native) - Recommended
- **Framework:** React Native with Expo (recommended) or bare React Native
- **Navigation:** React Navigation v6.x
- **Styling:** NativeWind v4.x (Tailwind for RN)
- **UI Components:** React Native Paper or React Native Elements
- **Animation:** React Native Reanimated v3.x
- **Icons:** react-native-vector-icons
- **State:** React Context API (same as web)
- **Storage:** AsyncStorage
- **Date Utils:** date-fns v4.1.0 (same as web)

---

## 📁 Detailed File-by-File Analysis

### Contexts (95% Reusable)

| File | Reusability | Changes Required |
|------|-------------|------------------|
| `context/ScheduleContext.jsx` | 100% | None - copy as-is |
| `context/ModalContext.jsx` | 100% | None - copy as-is |
| `context/ThemeContext.jsx` | 85% | Replace localStorage with AsyncStorage |

### Hooks (80% Reusable)

| File | Reusability | Changes Required |
|------|-------------|------------------|
| `hooks/useGoogleCalendar.js` | 80% | OAuth flow needs RN-specific library |

### Pages (30% Reusable)

| File | Reusability | Changes Required |
|------|-------------|------------------|
| `pages/Dashboard.jsx` | 30% | Rebuild all UI, keep logic |
| `pages/Calender.jsx` | 40% | Use react-native-calendars, keep event logic |
| `pages/Tasks.jsx` | 35% | Replace with FlatList, keep filtering logic |
| `pages/Assistant.jsx` | 40% | Rebuild chat UI, keep conversation logic |
| `pages/Settings.jsx` | 45% | Rebuild form UI, keep settings logic |
| `pages/Profile.jsx` | 35% | Rebuild profile UI, keep data logic |
| `pages/auth/Login.jsx` | 30% | Rebuild form, keep validation |
| `pages/auth/SignUp.jsx` | 30% | Rebuild form, keep validation |

### Components (15% Reusable)

| File | Reusability | Changes Required |
|------|-------------|------------------|
| `components/Sidebar.jsx` | 10% | Replace with React Navigation Drawer |
| `components/AddTaskModal.jsx` | 25% | Use RN Modal, rebuild form UI |
| `components/TaskDetailsModal.jsx` | 25% | Use RN Modal, rebuild detail UI |
| `components/TaskCard.jsx` | 30% | Rebuild with View/Text, keep data logic |
| `components/CalenderGrid.jsx` | 15% | Use react-native-calendars |
| `components/FloatingMicButton.jsx` | 20% | Use react-native-voice |
| `components/Navbar.jsx` | 5% | Replace with React Navigation header |
| `components/ui/*` | 0% | All shadcn/ui components need rebuilding |

---

## 🚀 Next Steps

1. **Decision Point:** Choose between Expo (easier, recommended) or bare React Native
2. **Proof of Concept:** Build one screen (e.g., Tasks list) to validate approach
3. **Setup Monorepo:** If maintaining both platforms, set up shared code structure
4. **Incremental Migration:** Convert screen by screen, testing as you go
5. **Platform-Specific Features:** Plan for iOS/Android specific features (notifications, calendar permissions, etc.)

---

**Document Generated:** 2025-11-24
**Project:** Schedu.ai
**Analysis Version:** 1.0
