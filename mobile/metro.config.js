const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg"],
};

// Dev-only: proxy /api to the Express backend so the web build runs same-origin
// (no CORS, and a tunnelled preview does not need a second public port).
const http = require("http");
const API_PROXY_PORT = Number(process.env.API_PROXY_PORT || 3005);

function proxyApi(middleware) {
  return (req, res, next) => {
    if (!req.url || !req.url.startsWith("/api")) return middleware(req, res, next);
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: API_PROXY_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${API_PROXY_PORT}` },
      },
      (response) => {
        res.writeHead(response.statusCode || 502, response.headers);
        response.pipe(res);
      }
    );
    upstream.on("error", () => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "API unavailable" }));
    });
    req.pipe(upstream);
  };
}

config.server = {
  ...(config.server || {}),
  enhanceMiddleware: (middleware) => proxyApi(middleware),
};

module.exports = withNativeWind(config, { input: "./global.css" });
