## Install (macOS 13 or later, Apple Silicon)

1. Download and open `Yalqen-…-arm64.dmg`, then drag Yalqen into the **Applications** folder.
2. The first time you open Yalqen, macOS says it cannot verify the app. Go to **System Settings › Privacy & Security** and click **Open Anyway** at the bottom. This is only needed once.
3. If macOS says the app is damaged, run this in Terminal and open it again:

   ```
   xattr -dr com.apple.quarantine /Applications/Yalqen.app
   ```

## Kurulum (macOS 13 veya üstü, Apple Silicon)

1. `Yalqen-…-arm64.dmg` dosyasını indirip açın ve Yalqen'i **Uygulamalar** klasörüne sürükleyin.
2. Yalqen'i ilk kez açtığınızda macOS uygulamayı doğrulayamadığını söyler. **Sistem Ayarları › Gizlilik ve Güvenlik** bölümüne gidip en alttaki **Yine de Aç** düğmesine basın. Bu adım yalnızca bir kez gerekir.
3. "Hasarlı" uyarısı görürseniz Terminal'de şunu çalıştırıp yeniden açın:

   ```
   xattr -dr com.apple.quarantine /Applications/Yalqen.app
   ```
