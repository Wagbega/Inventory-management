# Inventory POS Android Native App

This is the native Android application for the Inventory Management system, built with **Kotlin**, **Jetpack Compose**, and **Google Firebase Firestore**.

## Features
- **Real-time Synchronization**: Connected directly to Firestore database `ai-studio-inventorymanagem-5ba2abc3-ea2c-47f9-9374-8c46425eaa53`.
- **Remote Mobile Stock Intake**: Upload items from warehouse floor directly into desktop inventory.
- **Stock Audit & Stock-Take Tool**: Rapid increment/decrement buttons for physical inventory verification.
- **Catalog & Low Stock Indicators**: Instantly search items, filter by SKU or name, and view real-time balances.

## How to Run in Android Studio
1. Open **Android Studio** (Hedgehog or newer recommended).
2. Select **Open an Existing Project** and choose the `android/` directory.
3. Download your `google-services.json` from the Firebase Console (Project ID: `ai-studio-inventorymanagem-5ba2abc3-ea2c-47f9-9374-8c46425eaa53`) and place it inside `android/app/`.
4. Click **Build > Generate Signed Bundle / APK** or press **Run (Shift+F10)** to test on an emulator or connected Android device.
