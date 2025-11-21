/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './*.html',
        './**/*.html',
        '!./node_modules/**/*',
        '!./dist/**/*'
    ],
    theme: {
        extend: {}
    },
    plugins: []
};
