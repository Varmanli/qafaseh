const palettes = [
  { paper: "#e4e9da", ink: "#254c40", accent: "#d4a45d", muted: "#b2c3a4" },
  { paper: "#eee1d4", ink: "#824439", accent: "#d99466", muted: "#d5b6a0" },
  { paper: "#dfe7eb", ink: "#354f69", accent: "#d3aa68", muted: "#a7beca" },
  { paper: "#e8e0ed", ink: "#625074", accent: "#c88e86", muted: "#c4b1ce" },
  { paper: "#efe7cc", ink: "#686342", accent: "#b47b4f", muted: "#d0c397" },
  { paper: "#e6ded7", ink: "#4b5956", accent: "#b47c63", muted: "#c6b9a9" },
];

const knownSlugs = ["reading-guide", "book-recommendation", "genre-and-literature", "author-guide", "reading-list", "book-review"];

/** A permanent illustrated cover for categories without a custom image. */
export default function BlogCategoryArtwork({ slug }: { slug: string }) {
  const known = knownSlugs.indexOf(slug);
  const variant = known >= 0 ? known : Array.from(slug).reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  const { paper, ink, accent, muted } = palettes[variant];

  return (
    <svg aria-hidden="true" viewBox="0 0 600 360" fill="none" className="h-full w-full object-cover" preserveAspectRatio="xMidYMid slice">
      <path fill={paper} d="M0 0h600v360H0z" />
      <path d="M36 36h528v288H36z" stroke={ink} strokeOpacity=".12" />
      <circle cx="490" cy="64" r="115" fill={muted} opacity=".4" />
      <path d="M0 290c130-65 227-55 330 0s180 65 270 0v70H0z" fill={muted} opacity=".35" />
      <path d="M432 94v-9m0 9 8 4m-8-4-8 4M122 82v18m-9-9h18" stroke={ink} strokeOpacity=".35" strokeWidth="2" />
      <circle cx="474" cy="265" r="3" fill={ink} opacity=".35" />
      <circle cx="101" cy="235" r="5" stroke={ink} strokeOpacity=".3" />
      {variant % 3 === 0 ? (
        <>
          <path d="M201 296V142a99 99 0 0 1 198 0v154z" fill={muted} />
          <path d="M217 296V144a83 83 0 0 1 166 0v152" stroke={paper} strokeWidth="2" />
          <circle cx="301" cy="128" r="37" fill={accent} />
          <path d="M154 218c54-19 102-11 146 14 44-25 92-33 146-14v80c-54-19-102-11-146 14-44-25-92-33-146-14z" fill={ink} />
          <path d="M168 207c49-15 93-7 132 16 39-23 83-31 132-16v79c-49-15-93-7-132 16-39-23-83-31-132-16z" fill={paper} stroke={ink} strokeWidth="3" />
          <path d="M300 224v77m-108-68c29-3 53 2 81 15m-81 1c29-3 53 2 81 15m-81 1c29-3 53 2 81 15m54-32c28-13 52-18 81-15m-81 31c28-13 52-18 81-15m-81 31c28-13 52-18 81-15" stroke={ink} strokeWidth="2" strokeOpacity=".3" />
          <path d="M337 216v58l13-9 13 3v-61" fill={accent} />
        </>
      ) : variant % 3 === 1 ? (
        <>
          <circle cx="285" cy="168" r="110" fill={muted} />
          <circle cx="383" cy="92" r="30" fill={accent} />
          <g transform="rotate(-12 225 190)">
            <rect x="166" y="79" width="114" height="206" rx="6" fill={ink} />
            <path d="M179 79v206" stroke={paper} strokeOpacity=".35" strokeWidth="2" />
            <path d="M199 109h54m-54 8h36" stroke={paper} strokeWidth="3" strokeOpacity=".75" />
            <path d="m222 153 24 39-24 39-24-39z" fill={accent} />
            <path d="M200 259h45" stroke={paper} strokeOpacity=".5" strokeWidth="2" />
          </g>
          <g transform="rotate(12 340 210)">
            <rect x="284" y="115" width="112" height="182" rx="6" fill={accent} />
            <path d="M296 115v182m18-156h56m-56 8h38" stroke={ink} strokeWidth="2" strokeOpacity=".4" />
            <circle cx="342" cy="212" r="27" stroke={ink} strokeWidth="2" />
            <path d="M319 272h44" stroke={ink} strokeOpacity=".5" strokeWidth="2" />
          </g>
          <path d="M135 311h320" stroke={ink} strokeOpacity=".3" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M178 285V139a96 96 0 0 1 192 0v146z" fill={muted} />
          <circle cx="275" cy="128" r="37" fill={accent} />
          <rect x="159" y="265" width="265" height="33" rx="5" fill={ink} />
          <path d="M179 274h224m-224 9h224m-224 7h224" stroke={paper} strokeOpacity=".45" strokeWidth="2" />
          <rect x="187" y="227" width="221" height="32" rx="5" fill={accent} />
          <path d="M204 237h188m-188 10h188" stroke={paper} strokeOpacity=".65" strokeWidth="2" />
          <path d="m204 203 173-36 6 32-173 36z" fill={ink} />
          <path d="m220 210 148-31m-146 40 148-31" stroke={paper} strokeWidth="2" strokeOpacity=".5" />
          <path d="M420 267c-25-36-22-78-8-118m-1 58c-27-6-38-23-37-41 25 1 38 17 37 41m-5 29c26-10 37-27 32-47-23 4-35 21-32 47" stroke={ink} strokeWidth="3" />
          <path d="M132 309h327" stroke={ink} strokeOpacity=".3" strokeWidth="2" />
        </>
      )}
      <path d="M51 53h25m-25 0v25m498 229h-25m25 0v-25" stroke={ink} strokeOpacity=".3" />
    </svg>
  );
}
