const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The pnpm hoisted store (.pnpm/node_modules) exposes react@19.1.0 to packages
// that do not declare it (expo-router and friends). The mobile app must pin
// a single React version (19.0.0, required by expo/react-native-web). Only
// redirect when the default resolution lands on a DIFFERENT react copy.
const path = require("path");
const fs = require("fs");
const appReact = path.resolve(__dirname, "node_modules", "react");
const appReactDom = path.resolve(__dirname, "node_modules", "react-dom");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName === "react-dom") {
    const pinnedDir = moduleName === "react" ? appReact : appReactDom;
    const pinnedIndex = path.join(pinnedDir, "index.js");
    if (fs.existsSync(pinnedIndex)) {
      return { type: "sourceFile", filePath: pinnedIndex };
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
