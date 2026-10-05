import type { Metadata } from "next";
import { FileText, Handshake, Headset, Store, Truck, Wrench } from "lucide-react";
import { InfoContactCard } from "@/components/info/InfoContactCard";
import { InfoCard, InfoHeader, InfoSection, Prose } from "@/components/info/InfoContent";
import { LeadForm } from "@/components/forms/LeadForm";

export const metadata: Metadata = {
  title: "Співпраця",
  description:
    "Співпраця для СТО, автомагазинів, тюнінг-ательє та автопарків: індивідуальні умови, допомога з підбором і документообіг за рахунком. Залиште заявку — обговоримо деталі.",
  alternates: { canonical: "/spivpratsia" },
};

export default function SpivpratsiaPage() {
  return (
    <article className="space-y-10 lg:space-y-12">
      <InfoHeader
        title="Співпраця"
        lead="Працюєте у сфері авто й купуєте аксесуари регулярно? Обговоримо індивідуальні умови, допоможемо з підбором і налаштуємо документообіг за рахунком."
      />

      <InfoSection id="komu" title="Кому підійде співпраця">
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={<Wrench aria-hidden strokeWidth={1.75} />} title="СТО та тюнінг-ательє">
            Регулярний підбір аксесуарів і тюнінгу під замовлення клієнтів, консультації з сумісності й наявністю.
          </InfoCard>
          <InfoCard icon={<Store aria-hidden strokeWidth={1.75} />} title="Магазини автотоварів">
            Асортимент аксесуарів для вашої вітрини та зручна робота за безготівковим розрахунком.
          </InfoCard>
          <InfoCard icon={<Truck aria-hidden strokeWidth={1.75} />} title="Автопарки та бізнес">
            Оснащення власного автопарку аксесуарами з оплатою за рахунком і закривними документами.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoSection id="shcho" title="Що можемо обговорити">
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={<Handshake aria-hidden strokeWidth={1.75} />} title="Індивідуальні умови">
            Домовляємося про умови співпраці з огляду на обсяг і регулярність ваших замовлень.
          </InfoCard>
          <InfoCard icon={<Headset aria-hidden strokeWidth={1.75} />} title="Допомога з підбором">
            Пріоритетний підбір за моделлю авто та консультації, щоб швидше закривати потреби клієнтів.
          </InfoCard>
          <InfoCard icon={<FileText aria-hidden strokeWidth={1.75} />} title="Документообіг за рахунком">
            Безготівковий розрахунок, рахунки-фактури та закривні документи для вашої бухгалтерії.
          </InfoCard>
        </div>
        <Prose>
          <p>
            Конкретні умови залежать від формату вашого бізнесу й обсягу замовлень, тому обговорюємо їх індивідуально.
            Залиште заявку — і менеджер зв’яжеться, щоб уточнити деталі.
          </p>
        </Prose>
      </InfoSection>

      <InfoSection id="zaiavka" title="Залишити заявку на співпрацю">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)] lg:gap-10">
          <Prose className="lg:pt-1">
            <p>Що вказати в заявці, щоб ми швидше підготували пропозицію:</p>
            <ul>
              <li>тип бізнесу — СТО, магазин, тюнінг-ательє чи автопарк;</li>
              <li>місто та зручний спосіб зв’язку;</li>
              <li>які групи аксесуарів і марки авто вас цікавлять;</li>
              <li>орієнтовний обсяг і періодичність замовлень.</li>
            </ul>
          </Prose>
          <div className="card p-5 sm:p-6">
            <LeadForm
              kind="question"
              name="required"
              comment="required"
              commentPrefix="Співпраця"
              commentLabel="Розкажіть про ваш запит"
              commentPlaceholder="Наприклад: СТО у Львові, цікавлять килимки й дефлектори для Volkswagen та Skoda, 10–15 замовлень на місяць"
              submitLabel="Надіслати заявку"
              successTitle="Заявку надіслано"
              successText="Дякуємо! Менеджер зв’яжеться з вами найближчим часом, щоб обговорити умови співпраці."
            />
          </div>
        </div>
      </InfoSection>

      <InfoContactCard />
    </article>
  );
}
