# GK Magalang App — Setup Guide

## 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `gk-magalang` → Continue
3. Disable Google Analytics (optional) → **Create project**

## 2. Enable Firebase Services

### Authentication (Phone OTP)
1. In Firebase Console → **Authentication** → **Get started**
2. Click **Phone** → Enable → **Save**

### Firestore Database
1. **Firestore Database** → **Create database**
2. Choose **Start in test mode** (you'll add security rules later)
3. Pick a region close to Philippines (e.g. `asia-southeast1`)

### Storage
1. **Storage** → **Get started** → **Next** → **Done**

## 3. Get Your Firebase Config

1. **Project Settings** (gear icon) → **Your apps** → **Add app** → Web (`</>`)
2. App nickname: `gk-magalang-web` → **Register app**
3. Copy the `firebaseConfig` values

## 4. Set Up Environment Variables

```bash
cp .env.example .env.local
# Fill in the values from Firebase config
```

## 5. Install Dependencies & Run

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (available on Play Store / App Store).

## 6. Seed Household Data (One-time Setup)

In Firestore Console, create the **`households`** collection. Add 31 documents, one per house:

```
households/
  {auto-id}/
    houseNumber: 1
    familyName: "Santos"
    phone: "+639171234567"
    totalDue: 150000
```

Repeat for all 31 households.

## 7. Set Up Community Payment Info

Create a **`config/payment_info`** document in Firestore:

```
config/
  payment_info/
    gcashNumber: "09171234567"
    gcashName: "Juan Dela Cruz"
    mayaNumber: "09181234567"
    mayaName: "Juan Dela Cruz"
    bankName: "BDO"
    bankAccountName: "GK Magalang Community"
    bankAccountNumber: "1234567890"
```

## 8. Link User Accounts to Households

When a household member logs in for the first time:
1. In **Firestore** → **users** collection, find their document (keyed by Firebase UID)
2. Set `householdId` to the corresponding household document ID
3. Set `phone` to their phone number

## 9. Make Yourself Admin

After logging in once with the treasurer's phone number:
1. In Firestore → **users** → find the document with your UID (shown in Authentication)
2. Set `isAdmin: true`

The Admin tab will now be visible when you open the app.

## 10. Firestore Security Rules (Recommended before going live)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Any authenticated user can read households and payments
    match /households/{id} { allow read: if request.auth != null; }
    match /payments/{id} { allow read: if request.auth != null; }
    match /config/{id} { allow read: if request.auth != null; }

    // Users can create payments for their own household
    match /payments/{id} {
      allow create: if request.auth != null;
      // Only admins can update status
      allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // Users can only read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      // Admins can update any profile (to link householdId)
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

## Running on a Physical Device

- **Android**: Install Expo Go from Play Store, scan QR
- **iOS**: Install Expo Go from App Store, scan QR with Camera app

## Building for Distribution (App Store / Play Store)

```bash
npm install -g eas-cli
eas login
eas build --platform android   # generates APK/AAB
eas build --platform ios       # generates IPA (requires Apple Developer account)
```
