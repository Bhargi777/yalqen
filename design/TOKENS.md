# Tasarım kuralları

Faz 0 arayüz taslağının temel değerleri. Taslak: [`canvas/`](canvas) (etkileşimli tasarım sayfası kaynağı). Altyapı seçiminden bağımsızdır; Electron veya AppKit uygulaması bu değerleri kullanır.

## Renkler

Az renk: gri tonları + tek vurgu rengi. Uyarı rengi yalnızca bellek hedefi uyarısında kullanılır.

| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `bg` | `#f3f3f1` | `#1a1a19` | Pencere zemini, sekme paneli |
| `page` | `#ffffff` | `#232322` | Sayfa kartı |
| `surface` | `#ffffff` | `#2a2a28` | Aktif sekme, adres çubuğu, açılır paneller |
| `hover` | `#e8e8e5` | `#30302e` | Üzerine gelinmiş satır/düğme |
| `border` | `#e2e2de` | `#363634` | Ayırıcı çizgiler |
| `faint` | `#ededea` | `#2e2e2c` | İlerleme çubuğu zemini, segment kontrol zemini |
| `text` | `#1d1d1b` | `#ececea` | Ana metin |
| `muted` | `#66665f` | `#a3a39b` | İkincil metin, pasif ikonlar, uyuyan sekme başlığı |
| `accent` | `#2f5fd0` | `#86a6ff` | Odak halkası, canlı tut işareti, yükleme halkası |
| `accentSoft` | `#e7edfb` | `#26304a` | Vurgulu düğme zemini |
| `warn` | `#a34a06` | `#f0a35c` | Bellek hedefi uyarısı |
| `warnSoft` | `#fcefe2` | `#3a2a1a` | Uyarı kutusu zemini |

Metin kontrastı en az 4.5:1 hedeflenir (`muted` dahil).

## Yazı

- Yazı tipi: sistem fontu (`-apple-system`, SF Pro Text).
- Boyutlar: 11 px (yardımcı metin, RAM göstergesi), 12 px (ipucu, segment), 13 px (temel), 15 px (panel başlığı), 22 px (RAM toplamı).
- Kalınlık: 400 temel, 500 aktif sekme ve vurgulu düğme, 600 başlıklar.
- Sayılar: `font-variant-numeric: tabular-nums`.

## Ölçüler

| Öğe | Değer |
|---|---|
| Üst çubuk yüksekliği | 44 px |
| Adres çubuğu yüksekliği | 30 px |
| Sekme paneli — geniş (varsayılan) | 240 px, sürüklenerek 180–400 px |
| Sekme paneli — dar | 48 px |
| Sekme satırı | 32 px yükseklik, 2 px aralık |
| Site ikonu | 16 px |
| Araç çubuğu düğmesi | 28 px |
| Sekme satırı eylem düğmesi | 22 px |
| Boşluk ölçeği | 2, 4, 6, 8, 12, 16, 20 px |

## Köşe ve gölge

- Köşe: 4 px (site ikonu), 6 px (düğme), 8 px (sekme satırı, adres çubuğu), 10 px (sayfa kartı), 12–14 px (açılır panel, ayarlar).
- Gölge (açık): `0 1px 2px rgb(0 0 0 / .06), 0 0 0 1px rgb(0 0 0 / .05)`; açılır paneller daha belirgin.
- Koyu temada gölge yerine 1 px açık kontur.

## Hareket

- Geçişler 120 ms `ease-out`; yalnızca arka plan ve renk.
- Sürekli çalışan dekoratif animasyon yok. Yükleme halkası tek yay; `prefers-reduced-motion` açıkken geçişler kapanır.

## İkonlar

16 px ızgara, 1.4 px çizgi, yuvarlak uç. Rozetlerde 9 px ikon, 12 px daire.

## Sekme durumları

Hiçbir durum yalnızca renkle anlatılmaz.

| Durum | Görsel | Renk dışı ipucu |
|---|---|---|
| Aktif | `surface` zemin + gölge, başlık 500 | Gölge ile kabarık satır; `aria-current` |
| Canlı | Normal | — |
| Uyuyan (bellekten çıkarılmış) | İkon %40 ve gri, başlık `muted` | Ay rozeti (ikonun sağ altı) |
| Canlı tutulan | Rozet `accent` | İğne rozeti (ikonun sağ üstü); geniş görünümde dolu iğne düğmesi |
| Yükleniyor | İkon çevresinde yay | Yay şekli |
| Üzerine gelinmiş | `hover` zemin | Eylem düğmeleri görünür (canlı tut, uyut, kapat) |

Dar görünümde başlık ve durum, üzerine gelindiğinde ipucu balonunda yazıyla gösterilir.

## Taslaktaki yer tutucu değerler

RAM miktarları, bellek hedefi seçenekleri ve uyutma süreleri **örnektir**. Plan gereği gerçek değerler Faz 0 ölçümlerinden sonra belirlenecek.
