## Installation

1. Copy ``config/config.php.example`` to ``config/config.php`` and change the variables.
2. Run the setup script, e.g. ``php setup.php``
3. Setup a ``.htaccess`` file for routing:

```
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ public/$1 [L]
```

Optional for FiveServer (macOS example)

``fiveserver.config.js``

```
module.exports = {
    php: "/opt/homebrew/bin/php"
    }
```