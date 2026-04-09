const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx}", "./src/components/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class', // 'media' or 'class'
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "\"Open Sans\"",
          ...defaultTheme.fontFamily.sans
        ],
        mono: [
          "\"PT Mono\"",
          ...defaultTheme.fontFamily.mono
        ],
        primary: ["\"Hammersmith One\"", "sans-serif"]
      },
      colors: {
        primary: {
          alpha: "#C11F20B3",
          DEFAULT: "#C11F20" // Ronin red
        },
        secondary: {
          alpha: "#50B0F5B3",
          DEFAULT: "#50B0F5"
        },
        menuText: {
          DEFAULT: "#C0C0C0"
        },
        surface: "#141415",
        border: "#2A2C31",
        paragraph: "#959595",
        lightGrey: "#bababa",
        lighterGrey: "#efefef"
      },
      container: {
        center: true
      },
      dropShadow: {
        ...defaultTheme.dropShadow,
        menuItem: "0 0 8px #FFFFFFB3",
        heroHeading: "0 0 4px #FFFFFFB3",
        manage: "0 0 4px #50B0F5",
        none: "none"
      },
      boxShadow: {
        ...defaultTheme.boxShadow,
        primary: "0px 0px 10px #C11F20B3"
      },
      gridTemplateAreas: {
        "layout-wide": [
          "sidebar header",
          "sidebar main",
          "sidebar footer"
        ],
        "layout-slim": [
          "header",
          "main",
          "footer"
        ]
      },
      gridTemplateColumns: {
        "layout-wide": "20rem 1fr",
        "layout-slim": "1fr",
      },
      gridTemplateRows: {
        "layout-wide": "5rem 1fr 3rem",
        "layout-slim": "5rem 1fr 3rem",
        "simpleLayout": "minmax(5rem, 1fr) 1fr"
      }
    }
  },
  variants: {
    extend: {
      textShadow: ["responsive", "hover"],
      inset: ["before", "after"],
      transform: ["before", "after"],
      transformOrigin: ["before", "after"],
      rotate: ["before", "after"],
      borderColor: ["before", "after", "disabled"],
      borderStyle: ["before", "after"],
      borderWidth: ["before", "after"],
      width: ["before", "after"],
      height: ["before", "after"],
      translate: ["before", "after"],
      position: ["before", "after"],
      textColor: ["disabled"]
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@savvywombat/tailwindcss-grid-areas"),
    require("tailwindcss-typography"),
    require("tailwind-pseudo-elements")
  ]
};
