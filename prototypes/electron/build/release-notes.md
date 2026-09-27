## Kurulum (macOS 13 veya üstü, Apple Silicon)

1. `Yalqen-…-arm64.dmg` dosyasını indirip açın ve Yalqen'i **Uygulamalar** klasörüne sürükleyin.
2. Yalqen'i ilk kez açtığınızda macOS uygulamayı doğrulayamadığını söyler. **Sistem Ayarları › Gizlilik ve Güvenlik** bölümüne gidip en alttaki **Yine de Aç** düğmesine basın. Bu adım yalnızca bir kez gerekir.
3. "Hasarlı" uyarısı görürseniz Terminal'de şunu çalıştırıp yeniden açın:

   ```
   xattr -dr com.apple.quarantine /Applications/Yalqen.app
   ```
