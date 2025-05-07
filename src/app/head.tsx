

  export default function Head() {
    return (
      <>
        <title>Qubit Lab</title>
        <meta name="description" content="Quantum Computing. Demystified." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Favicon for modern browsers */}
        <link rel="icon" type="image/x-icon" href="/favicon-v2.ico" />
        <link rel="shortcut icon" href="/favicon-v2.ico" />
        <link rel="icon" type="image/png" href="/favicon-v2-32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon-v2-16.png" sizes="16x16" />
        
        {/* iOS icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        <meta name="theme-color" content="#0f172a" />
      </>
    );
  }