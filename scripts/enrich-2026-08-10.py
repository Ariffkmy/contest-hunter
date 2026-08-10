#!/usr/bin/env python3
"""One-off enrichment pass for the 2026-08-10 scrape (kept in scripts/enrich-2026-08-10.py for the record)."""
import json, sys, copy

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
PATH = "/Users/atiqahbaiduri/contest-hunter/src/data/instagram-giveaways.json"
d = json.load(open(PATH))

FIX = {
  # code -> {fields...}
  "DbsBkd0pAL2": dict(prize="One-night stay in a Classic Suite (IG winner + FB winner)",
                      conditions=["Like and follow 1001 Nights Hotel on Instagram or Facebook",
                                  "Count all the Malaysian flags in the poster",
                                  "Comment your answer below"],
                      deadline="2026-09-16 (winners 2026-09-25)",
                      contest_type="comment+follow+like"),
  "DbaKmGxEUW4": dict(prize="Insta360 Luna Ultra (3 winners, worth S$969 each)",
                      conditions=["Enter the TOYOGO 40th anniversary giveaway"],
                      contest_type="entry"),
  "Dbf5ZQTjCjn": dict(prize="Fukuro Redi 4-Piece Non-Stick Cookware Set (3 winners)",
                      conditions=["Follow Fukuro Singapore on Facebook & Instagram",
                                  "Like the post and comment which Singapore dish you'd cook",
                                  "Share the post and tag 2 friends"],
                      deadline="2026-08-10",
                      contest_type="comment+follow+share+tag+like"),
  "DOCloFXiiEB": dict(prize="Hadiah bernilai lebih RM300,000",
                      conditions=["Beli produk Ayam Brand bernilai RM20 ke atas dalam satu resit",
                                  "Isi borang di ayambrand.com.my/menanglainmacam atau imbas QR"],
                      deadline="2025-10-30",
                      contest_type="purchase"),
  "Dbj6SR_m0yl": dict(prize="Huggies Free Sense (5 winners)",
                      conditions=["Comment feature Huggies Free Sense yang paling excited untuk dicuba",
                                  "Tag 3 parent friends",
                                  "Share post ke IG Story & tag @huggiesmy @lazada_my"],
                      contest_type="comment+tag+share"),
  "Dbu3rRymV8B": dict(prize="Prizes worth up to RM35,888 (spin & win)",
                      conditions=["Purchase RM50 ke atas produk Morinaga dalam satu resit",
                                  "Scan QR dan upload resit",
                                  "Spin the wheel (RM50 = 1 spin, maksimum 6 spin)"],
                      deadline="2026-09-03",
                      contest_type="purchase"),
  "DbdKfVwhqpU": dict(prize="Hegen prizes worth RM232.80",
                      conditions=["Follow @hegen.malaysia",
                                  "Upload baby selfie + story dan tag 3 friends",
                                  "Share post ke story & tag @hegen.malaysia"],
                      deadline="2026-08-09",
                      contest_type="comment+follow+share+tag"),
  "DbZ_hCwSRGn": dict(prize="Home essentials (details & T&C coming)",
                      conditions=["Shop with Hyleen Vendors 1–31 August 2026"],
                      deadline="2026-08-31",
                      contest_type="purchase"),
  "DbdRIwVS8_l": dict(prize="RM100 + produk Muslim Foods (pemenang utama), RM50 + produk (5x saguhati)",
                      conditions=["Ambil gambar troli berisi produk Muslim Foods Industry dan tag akaun",
                                  "Sertakan caption produk pilihan anda",
                                  "Tag 3 kenalan + hashtag #TroliMerdekaMFI #MuslimFoodsIndustry",
                                  "Isi maklumat penyertaan di muslimfood.com.my"],
                      deadline="2026-08-31",
                      contest_type="purchase+tag"),
  "DPrQ4fokgR0": dict(prize="1x Proton e.MAS7 + RM500 tunai x100 pemenang/bulan",
                      conditions=["Beli minimum RM30 produk NTPM dalam satu resit",
                                  "Imbas QR code",
                                  "Isi maklumat, jawab soalan, muat naik resit"],
                      deadline="2026-01-31",
                      contest_type="purchase"),
  "Db2elsbyyrA": dict(prize="Hadiah Contest JOMBUS HUNT (details on social media)",
                      conditions=["Follow social media Pak Gembus untuk full steps"],
                      contest_type="entry"),
  "DbuEKmVE5_b": dict(prize="RM100 (5 pemenang paling kreatif), RM50 (10 pemenang terpilih)",
                      conditions=["Tunjukkan semangat patriotik dan kreativiti bersama Flamitoz"],
                      deadline="2026-09-20",
                      contest_type="entry"),
  "Dbkn7qtBOyC": dict(prize="Hadiah saguhati RM20 (peserta layak)",
                      conditions=[],
                      contest_type="entry"),
  "DbIBokzE_1T": dict(prize="RM1,000 (Tempat 1), RM700 (Tempat 2), RM500 (Tempat 3), RM300 (3x saguhati)",
                      conditions=["Cipta logo sambutan 30 Tahun Majlis Perbandaran Selayang",
                                  "Imbas kod QR pada poster untuk syarat penuh"],
                      deadline="2026-08-15",
                      contest_type="entry"),
  "DbwnJVBj7Mq": dict(prize="Pipit Writing Competition (no entrance fee)",
                      conditions=["Umur 15–19 tahun (2026)",
                                  "Tulis karya fiksyen (fiction writing)"],
                      deadline="2026-09-15",
                      contest_type="entry"),
  "DCQicdlvYiH": dict(prize="RM250 Touch n' Go e-Wallet Reload PIN (5 karya paling kreatif)",
                      conditions=["Create digital art bertema sustainable palm oil"],
                      deadline="2024-12-23",
                      contest_type="entry"),
  "DM4m2navYdX": dict(prize="Hadiah bernilai RM3000",
                      conditions=["Buat video pendek tema MERDEKA (watak utama berpakaian kuning terang)",
                                  "Hantar karya ke creative@avrichnation.com.my"],
                      deadline="2025-09-15",
                      contest_type="entry"),
  "DbnDUpghVwz": dict(prize="Pertandingan Mencipta Poster Infografik (hadiah wang tunai)",
                      conditions=["Ahli Pertubuhan Bukan Kerajaan (NGO)",
                                  "Cipta poster infografik bahan bacaan karya sastera"],
                      contest_type="entry"),
  "Dbmp9_qDIJk": dict(prize="10 pemenang bertuah (teka nama mascot)",
                      conditions=["Follow dan Like Facebook & IG Dragon Fruit Brand",
                                  "Teka 7 nama mascot di ruangan komen",
                                  "Repost di IG Story atau FB Story",
                                  "Tag DragonFruit brand + hashtag #youmochamecrazy #midvalley"],
                      deadline="2026-08-11 (winners 2026-08-13)",
                      contest_type="comment+follow+tag+share+like"),
  "Dbr4nuTjg2O": dict(prize="Free tickets (3 winners) untuk Grand Opening",
                      conditions=["Follow @ripleysinteractivemuseum on FB/IG",
                                  "Comment most unbelievable talent",
                                  "Tag 3 friends"],
                      contest_type="comment+follow+tag"),
  # deadline fixes for preserved (prev) values that are junk
  "DbfQVbqJsxQ": dict(deadline="2026-08-31 (End of August)"),
  "DbVfcftit8W": dict(deadline=None),
}

by_code = {c["post_url"].split("/p/")[1].rstrip("/"): c for c in d["contests"]}
applied = 0
for code, fields in FIX.items():
    c = by_code.get(code)
    if not c:
        print(f"!! missing {code}")
        continue
    for k, v in fields.items():
        c[k] = v
    applied += 1

json.dump(d, open(PATH, "w"), ensure_ascii=False, indent=2)
print(f"enriched {applied} contests; total={d['total']}")
