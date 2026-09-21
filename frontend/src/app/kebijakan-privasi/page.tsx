import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, English, getStoreInfo, waLink } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Kebijakan Privasi" };
export const dynamic = "force-dynamic";

const UPDATED = "21 September 2026";

export default async function KebijakanPrivasiPage() {
    const store = await getStoreInfo();
    const wa = waLink(store.phone);
    return (
        <LegalPage title="Kebijakan Privasi" updated={UPDATED} store={store}>
            <Section title="1. Tentang kebijakan ini">
                <p>
                    Kebijakan ini menjelaskan bagaimana <b>{store.name}</b> mengumpulkan, memakai, dan melindungi data pelanggan
                    yang menghubungi kami lewat WhatsApp, Instagram, Facebook Messenger, komentar di postingan Instagram/Facebook kami,
                    maupun datang langsung ke toko. Data tersebut dikelola di <b>PosPro</b>, sistem kasir dan layanan pelanggan internal
                    yang hanya dipakai oleh staf {store.name}.
                </p>
            </Section>

            <Section title="2. Data yang kami kumpulkan">
                <ul>
                    <li><b>Identitas akun</b>: nama atau username, serta nomor ID akun yang diberikan WhatsApp/Instagram/Facebook kepada kami.</li>
                    <li><b>Nomor WhatsApp</b> bila Anda menghubungi kami lewat WhatsApp.</li>
                    <li><b>Isi pesan dan komentar</b> yang Anda kirim kepada kami, termasuk gambar/berkas lampiran, beserta postingan yang Anda komentari.</li>
                    <li><b>Data pesanan</b> yang Anda berikan: nama, nomor telepon, rincian cetakan, desain, pembayaran, dan alamat pengiriman bila ada.</li>
                </ul>
                <p>Kami tidak meminta kata sandi akun media sosial Anda dan tidak mengakses pesan Anda dengan pihak lain.</p>
            </Section>

            <Section title="3. Cara kami memakai data">
                <ul>
                    <li>Menjawab pertanyaan, memberi penawaran harga, dan memproses pesanan Anda.</li>
                    <li>Mengabarkan status pesanan (misalnya pesanan siap diambil) dan menagih pembayaran.</li>
                    <li>Menjaga mutu layanan, misalnya meminta penilaian atas pelayanan staf kami.</li>
                    <li>Mengirim informasi promo lewat WhatsApp kepada pelanggan. Anda bisa meminta berhenti kapan saja.</li>
                </ul>
                <p>
                    Data dari Instagram dan Facebook (Meta) <b>hanya</b> dipakai untuk membalas dan melayani Anda. Data itu tidak dijual,
                    tidak dipakai untuk menargetkan iklan pihak lain, dan tidak diberikan kepada pihak ketiga.
                </p>
            </Section>

            <Section title="4. Berbagi data">
                <p>Kami tidak menjual data Anda. Data hanya melewati atau disimpan oleh pihak yang diperlukan untuk menjalankan layanan:</p>
                <ul>
                    <li>Meta (WhatsApp, Instagram, Facebook) sebagai platform pengiriman pesan dan komentar.</li>
                    <li>Layanan penyimpanan awan untuk salinan cadangan (backup) sistem, agar data pesanan tidak hilang.</li>
                    <li>Pihak berwenang bila diwajibkan oleh hukum.</li>
                </ul>
            </Section>

            <Section title="5. Penyimpanan dan keamanan">
                <p>
                    Data disimpan di server milik {store.name}. Akses dibatasi hanya untuk staf yang memiliki akun login dan
                    hak akses sesuai tugasnya. Data disimpan selama diperlukan untuk melayani pesanan dan untuk kewajiban pembukuan,
                    atau sampai Anda meminta penghapusan.
                </p>
            </Section>

            <Section title="6. Hak Anda">
                <p>
                    Anda dapat meminta salinan, perbaikan, atau penghapusan data Anda. Cara mengajukan penghapusan data dijelaskan di halaman{" "}
                    <Link href="/hapus-data" className="text-primary underline">Penghapusan Data</Link>.
                </p>
            </Section>

            <Section title="7. Perubahan kebijakan">
                <p>Kebijakan ini dapat diperbarui sewaktu-waktu. Tanggal pembaruan terakhir tercantum di bagian atas halaman ini.</p>
            </Section>

            <Section title="8. Hubungi kami">
                <p>
                    Pertanyaan tentang privasi dapat disampaikan ke {store.name}
                    {store.phone && <> melalui telepon/WhatsApp <b>{store.phone}</b>{wa && <> (<a href={wa} className="text-primary underline" target="_blank" rel="noopener noreferrer">kirim WhatsApp</a>)</>}</>}
                    {store.address && <>, atau datang ke {store.address}</>}.
                </p>
            </Section>

            <English>
                <p>
                    <b>{store.name}</b> uses PosPro, an internal point-of-sale and customer-service system operated only by our own staff,
                    to answer customers who contact us via WhatsApp, Instagram Direct, Facebook Messenger, or comments on our own
                    Instagram/Facebook posts.
                </p>
                <ul>
                    <li><b>Data we collect:</b> your name or username and the account ID provided by the platform, your WhatsApp number, the content of messages and comments you send us (including attachments), and order details you give us.</li>
                    <li><b>How we use it:</b> only to reply to you, prepare quotes, process and deliver orders, send order-status updates, and maintain service quality.</li>
                    <li><b>Meta Platform Data</b> from Instagram and Facebook is used solely to respond to and serve you. We do not sell it, use it for third-party ad targeting, or share it with third parties.</li>
                    <li><b>Storage:</b> on our own server with access limited to authorized staff; kept as long as needed for service and bookkeeping, or until you ask us to delete it.</li>
                    <li><b>Your rights:</b> you may request access to, correction of, or deletion of your data — see <Link href="/hapus-data" className="text-primary underline">Data Deletion</Link>.</li>
                    <li><b>Contact:</b> {store.name}{store.phone ? `, phone/WhatsApp ${store.phone}` : ""}{store.address ? `, ${store.address}` : ""}.</li>
                </ul>
            </English>
        </LegalPage>
    );
}
