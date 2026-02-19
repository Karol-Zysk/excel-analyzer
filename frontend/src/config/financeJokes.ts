export type FinanceJoke = {
  id: number;
  text: string;
  tag: string;
};

export const FINANCE_JOKES_CATEGORY = "Humor finansowo-ksiegowy";
export const FINANCE_JOKES_TOPIC = "KSeF i ksiegowosc";
export const FINANCE_JOKES_DISCLAIMER =
  "Zarty maja charakter satyryczny. Autor nie ponosi odpowiedzialnosci za pekniete zebra ani za bledy walidacji w KSeF.";

export const FINANCE_JOKES: FinanceJoke[] = [
  {
    id: 1,
    text: "Jak nazywa sie ksiegowa po wdrozeniu KSeF? Bezrobotna. Zartuje. Teraz zajmuje sie naprawianiem bledow, ktore KSeF odrzucil.",
    tag: "KSeF"
  },
  {
    id: 2,
    text: "Przedsiebiorca pyta doradce podatkowego: Czy KSeF jest skomplikowany? Doradca: Nie bardziej niz skladanie instrukcji IKEA po szwedzku, w ciemnosci, podczas gdy US do ciebie dzwoni.",
    tag: "KSeF"
  },
  {
    id: 3,
    text: "KSeF to jedyny system, ktory potrafi odrzucic fakture, zanim przedsiebiorca zdazyl pomyslec, zeby ja wystawic.",
    tag: "KSeF"
  },
  {
    id: 4,
    text: "Czym rozni sie ksiegowy od chirurga? Chirurg moze operowac bez znieczulenia. Ksiegowy bez kawy nigdy.",
    tag: "Ksiegowosc"
  },
  {
    id: 5,
    text: "Ministerstwo Finansow oglosilo, ze KSeF bedzie prosty i intuicyjny. Ta sama firma zrobila wczesniej formularz PIT z 47 zalacznikami.",
    tag: "KSeF"
  },
  {
    id: 6,
    text: "Moja ksiegowa po wdrozeniu KSeF zmowila sie z psychiatra. Nie wiem, kto zarabia wiecej.",
    tag: "KSeF"
  },
  {
    id: 7,
    text: "Dlaczego ksiegowi nie wychodza na spacery? Bo boja sie, ze paragony z kawiarni tez trzeba gdzies zaksiegowac.",
    tag: "Ksiegowosc"
  },
  {
    id: 8,
    text: "KSeF offline dziala tak sprawnie, ze faktury wystawione dzisiaj trafia do systemu, gdy twoje wnuki pojda na emeryture.",
    tag: "KSeF offline"
  },
  {
    id: 9,
    text: "Jak uspokoisz spanikowanego przedsiebiorce przed wdrozeniem KSeF? Powiedz mu, ze termin znowu zostanie przesuniety.",
    tag: "KSeF"
  },
  {
    id: 10,
    text: "Urzad Skarbowy, KSeF i VAT wchodza do baru. Bartender mowi: Przepraszam, nie obslugujemy podmiotow terroryzujacych MSP.",
    tag: "Podatki"
  }
];
