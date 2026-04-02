import { defineConfig } from 'vite'

export default defineConfig({
    // 'base' assure que les liens vers tes scripts et textures
    // utilisent des chemins relatifs, évitant les erreurs 404 sur les assets.
    base: './',
    build: {
        // On s'assure que le dossier de sortie est bien 'dist'
        outDir: 'dist',
        // Optionnel : vide le dossier avant de build pour éviter les vieux fichiers
        emptyOutDir: true,
    },
    server: {
        // Utile pour le développement local
        host: true
    }
})