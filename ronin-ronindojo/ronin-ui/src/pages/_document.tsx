import React from "react";
import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en" className="h-full">
        <Head>
          <meta name="theme-color" content="#C11F20" />
        </Head>
        <body className="h-full antialiased">
          <noscript>
            <p
              style={{
                marginLeft: "1%",
                backgroundColor: "#c40201",
                marginRight: "1%",
                textAlign: "center",
                fontSize: 20,
                padding: 10,
              }}
            >
              You have to enable Javascript for Ronin UI to function properly.
            </p>
          </noscript>
          <Main />
          <NextScript />
          <div id="dialog-root" />
        </body>
      </Html>
    );
  }
}
