module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2018,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    // Windows (core.autocrlf) checkouts use CRLF; Google preset requires LF.
    "linebreak-style": "off",
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
    {
      files: ["**/*.test.js"],
      env: {
        jest: true,
      },
      rules: {
        "valid-jsdoc": "off",
        "require-jsdoc": "off",
      },
    },
  ],
  globals: {},
};
