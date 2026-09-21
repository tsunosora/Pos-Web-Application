import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, English, getStoreInfo, waLink } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Penghapusan Data" };
export const dynamic = "force-dynamic";

const UPDATED = "21 September 2026";

export default async function HapusDataPage() {
    const store = await getStoreInfo();
    const wa = waLink(store.phone);
    const waHapus = wa ? `${wa}?text=${encodeURIComponent("HAPUS DATA\nNama: \nUsername Instagram/Facebook atau nomor WhatsApp: ")}` : null;
    return (
        <LegalPage title="Penghapusan Data" updated={UPDATED} store={store}>
            <Section title="Cara meminta penghapusan data">
                <p>
                    Anda dapat meminta {store.name} menghapus data Anda yang tersimpan di sistem kami, termasuk data yang berasal dari
                    WhatsApp, Instagram, dan Facebook. Caranya:
                </p>
                <ol>
                    <li>
                        Kirim pesan berisi <b>HAPUS DATA</b>
                        {store.phone ? <> ke WhatsApp <b>{store.phone}</b></> : " lewat WhatsApp kami"}
                        {waHapus && <> (<a href={waHapus} className="text-primary underline" target="_blank" rel="noopener noreferrer">klik untuk mengirim</a>)</>}
                        , atau lewat DM Instagram/Facebook kami.
                    </li>
                    <li>Sebutkan nama Anda serta username Instagram/Facebook atau nomor WhatsApp yang Anda pakai menghubungi kami.</li>
                    <li>Kami akan memastikan permintaan benar dari pemilik akun, lalu menghapus data paling lambat <b>30 hari</b> dan mengabarkannya lewat saluran yang sama.</li>
                </ol>
                {store.address && <p>Anda juga dapat datang langsung ke toko kami di {store.address}.</p>}
            </Section>

            <Section title="Data yang dihapus">
                <ul>
                    <li>Data kontak Anda di sistem kami (nama/username dan ID akun).</li>
                    <li>Riwayat percakapan WhatsApp, Instagram, dan Messenger dengan kami.</li>
                    <li>Salinan komentar Anda pada postingan kami yang tersimpan di sistem kami.</li>
                    <li>Catatan prospek (calon pelanggan) atas nama Anda.</li>
                </ul>
            </Section>

            <Section title="Data yang tetap disimpan">
                <p>
                    Catatan transaksi dan nota yang wajib disimpan untuk pembukuan tetap kami simpan sesuai kewajiban hukum,
                    dengan data seminimal mungkin.
                </p>
                <p>
                    Menghapus data di sistem kami tidak menghapus pesan atau komentar di aplikasi WhatsApp, Instagram, atau Facebook itu
                    sendiri. Komentar Anda di postingan kami dapat Anda hapus sendiri langsung dari aplikasi Instagram/Facebook.
                </p>
                <p>
                    Keterangan lengkap tentang data yang kami kumpulkan ada di{" "}
                    <Link href="/kebijakan-privasi" className="text-primary underline">Kebijakan Privasi</Link>.
                </p>
            </Section>

            <English>
                <p>To request deletion of your data held by <b>{store.name}</b> (including data received from WhatsApp, Instagram, and Facebook):</p>
                <ol>
                    <li>Send a message saying <b>DELETE MY DATA</b> {store.phone ? <>to our WhatsApp <b>{store.phone}</b></> : "to our WhatsApp"} or via Instagram/Facebook direct message.</li>
                    <li>Include your name and the Instagram/Facebook username or WhatsApp number you used to contact us.</li>
                    <li>After verifying the request, we delete your contact record, conversation history, stored copies of your comments, and lead records within <b>30 days</b>, and confirm through the same channel.</li>
                </ol>
                <p>Transaction records we are legally required to keep for bookkeeping are retained with minimal data. See our <Link href="/kebijakan-privasi" className="text-primary underline">Privacy Policy</Link>.</p>
            </English>
        </LegalPage>
    );
}
