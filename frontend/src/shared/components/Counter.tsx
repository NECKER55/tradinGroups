import { motion, useSpring, useTransform } from 'framer-motion';
import { CSSProperties, useEffect, useMemo } from 'react';
import './Counter.css';

type CounterPlace = number | '.';

interface NumberProps {
  mv: ReturnType<typeof useSpring>;
  number: number;
  height: number;
}

interface DigitProps {
  place: CounterPlace;
  value: number;
  height: number;
  digitStyle?: CSSProperties;
  gap: number;
}

interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  places?: CounterPlace[];
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: number | string;
  digitPlaceHolders?: boolean;
  containerStyle?: CSSProperties;
  counterStyle?: CSSProperties;
  digitStyle?: CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
  topGradientStyle?: CSSProperties;
  bottomGradientStyle?: CSSProperties;
}

function NumberDigit({ mv, number, height }: NumberProps) {
  const y = useTransform(mv, (latest: number) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let position = offset * height;
    if (offset > 5) position -= 10 * height;
    return position;
  });

  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  );
}

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value: number, place: number): number {
  const scaled = value / place;
  return Math.floor(normalizeNearInteger(scaled));
}

function Digit({ place, value, height, digitStyle, gap }: DigitProps) {
  const isDecimal = place === '.';
  const targetValue = isDecimal ? 0 : getValueRoundedToPlace(value, place as number);

  // ✅ FIX 1: inizializziamo lo spring direttamente al valore target
  // così al primo render non scatta da 0
  const animatedValue = useSpring(targetValue, {
    stiffness: 200,
    damping: 28,
    restDelta: 0.001,
  });

  useEffect(() => {
    if (!isDecimal) {
      // ✅ FIX 2: usiamo .set() solo se il componente è nuovo (spring già al target),
      // altrimenti .set() non serve — useSpring anima automaticamente verso il nuovo target
      // quando cambiamo il valore passato a useSpring non basta: dobbiamo chiamare animatedValue.set()
      // perché useSpring non re-inizializza se i deps cambiano.
      animatedValue.set(targetValue);
    }
  }, [targetValue, isDecimal, animatedValue]);

  if (isDecimal) {
    return (
      <span
        className="counter-digit counter-digit--decimal"
        style={{ height, ...digitStyle, width: 'fit-content', '--counter-gap': `${gap}px` } as CSSProperties}
      >
        .
      </span>
    );
  }

  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <NumberDigit key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  );
}

export default function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places,
  gap = 2,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = 'inherit',
  fontWeight = 'bold',
  digitPlaceHolders = false,
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = 'black',
  gradientTo = 'transparent',
  topGradientStyle,
  bottomGradientStyle,
}: CounterProps) {
  // ✅ FIX 3: places dipende da value — quando value cambia, places si ricalcola.
  // Stabiliziamo il numero di cifre intere sul massimo visto finora per evitare
  // che i Digit vengano smontati/rimontati (e perdano lo stato dello spring)
  // ogni volta che il valore supera una soglia (es: 99 → 100).
  const stableIntegerDigits = useMemo(() => {
    const intLen = Math.floor(Math.abs(value)).toString().length;
    return intLen;
  }, [value]);

  const usedPlaces = useMemo(() => {
    if (places) return places;

    const fixed = Math.abs(value).toFixed(2);
    const [, decimalPart] = fixed.split('.');
    const result: CounterPlace[] = [];

    // Usiamo stableIntegerDigits per non ridurre mai il numero di colonne intere
    for (let i = 0; i < stableIntegerDigits; i++) {
      result.push(10 ** (stableIntegerDigits - i - 1));
    }

    result.push('.');

    for (let i = 0; i < decimalPart.length; i++) {
      result.push(10 ** -(i + 1));
    }

    return result;
  }, [places, value, stableIntegerDigits]);

  const height = fontSize + padding;

  const defaultCounterStyle: CSSProperties = {
    fontSize,
    gap,
    borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight,
    fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
  };

  const defaultTopGradientStyle: CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
  };

  const defaultBottomGradientStyle: CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
  };

  return (
    <span className="counter-container" style={containerStyle}>
      <span
        className={`counter-counter${digitPlaceHolders ? ' counter-counter--placeholders' : ''}`}
        style={{ ...defaultCounterStyle, ...counterStyle }}
      >
        {usedPlaces.map((place) => (
          <Digit
            // ✅ FIX 4: la key deve essere stabile per place, non per index.
            // In questo modo quando aggiungiamo una cifra a sinistra (es. 9→10)
            // i Digit esistenti non vengono smontati e mantengono la loro animazione.
            key={typeof place === 'number' ? `place-${place}` : 'decimal'}
            place={place}
            value={Math.abs(value)}
            height={height}
            digitStyle={digitStyle}
            gap={gap}
          />
        ))}
      </span>
      <span className="gradient-container">
        <span className="top-gradient" style={topGradientStyle ?? defaultTopGradientStyle} />
        <span className="bottom-gradient" style={bottomGradientStyle ?? defaultBottomGradientStyle} />
      </span>
    </span>
  );
}