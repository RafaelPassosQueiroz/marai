import { useId } from 'react';
import type { Appearance } from '../models/types';

export function Avatar({
    appearance: a,
    className = '',
    name = 'Personagem fictício',
}: {
    appearance: Appearance;
    className?: string;
    name?: string;
}) {
    const id = useId().replace(/:/g, '');
    const round = a.face === 'round';
    const angular = a.face === 'angular';
    const face = round
        ? 'M128 158Q122 115 165 101Q218 80 268 113Q302 139 290 204L283 251Q276 291 214 307Q153 297 138 254Z'
        : angular
          ? 'M133 151Q140 100 211 99Q280 96 290 150L283 243L258 284L216 311L171 287L143 248Z'
          : 'M133 154Q130 104 200 97Q276 91 289 148L285 226Q279 280 239 301Q217 315 195 300Q149 278 140 230Z';
    return (
        <svg viewBox="0 0 420 580" className={`avatar ${className}`} role="img" aria-label={name}>
            <defs>
                <linearGradient id={`${id}skin`} x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor={a.skin} />
                    <stop offset="1" stopColor={a.skin} />
                </linearGradient>
                <linearGradient id={`${id}cloth`} x1="0" x2="1" y1="0" y2="1">
                    <stop stopColor={a.clothing_color} />
                    <stop offset="1" stopColor={a.clothing_color} />
                </linearGradient>
                <linearGradient id={`${id}shade`} x1="0" x2="1">
                    <stop stopColor="#061c31" stopOpacity="0" />
                    <stop offset="1" stopColor="#061c31" stopOpacity=".22" />
                </linearGradient>
            </defs>
            <ellipse cx="212" cy="562" rx="142" ry="13" fill="#183f42" opacity=".13" />
            {/* Hair behind shoulders; front hair is intentionally drawn after the face. */}
            {(a.hair === 'long' || a.hair === 'braids' || a.hair === 'bob') && (
                <g fill={a.hair_color} stroke="#302b2a" strokeWidth="3">
                    <path
                        d={
                            a.hair === 'bob'
                                ? 'M114 160Q105 72 202 66Q309 65 307 160L316 294Q274 328 115 289Z'
                                : 'M117 162Q97 77 202 65Q313 65 306 172L329 403Q284 444 105 402Z'
                        }
                    />
                    {a.hair === 'braids' &&
                        [0, 1, 2, 3, 4, 5].map((n) => (
                            <g key={n}>
                                <ellipse cx={120 - n * 2} cy={245 + n * 24} rx="20" ry="21" />
                                <ellipse cx={299 + n * 2} cy={245 + n * 24} rx="20" ry="21" />
                            </g>
                        ))}
                </g>
            )}
            {/* Neck and independently colored clothing. */}
            <path
                d="M173 268L171 326Q149 342 129 353L190 415L272 352Q247 339 247 320L249 266"
                fill={a.skin}
                stroke="#805a41"
                strokeWidth="2.5"
            />
            <path
                d="M175 277Q212 318 247 278L247 311Q209 339 174 307Z"
                fill="#855032"
                opacity=".18"
            />
            <path
                d="M169 324Q190 348 216 349Q239 346 254 325L291 345Q340 360 358 422L382 572H39L60 428Q69 368 132 345Z"
                fill={`url(#${id}cloth)`}
                stroke="#263b49"
                strokeWidth="3"
            />
            <path
                d="M168 328L188 364L218 383L250 346L251 327Q233 348 216 349Q185 345 168 328Z"
                fill="#f3eee3"
            />
            {a.outfit === 'jacket' && (
                <g stroke="#263b49" strokeWidth="3" strokeLinejoin="round">
                    <path
                        d="M165 321L136 342L151 408L180 382L187 571H113L109 395"
                        fill={a.clothing_color}
                    />
                    <path
                        d="M254 322L278 342L285 403L254 380L244 571H322L316 397"
                        fill={a.clothing_color}
                    />
                    <path d="M182 391L194 572M251 391L232 572" fill="none" opacity=".65" />
                    <path d="M264 459H301V500H263" fill="none" opacity=".5" />
                    <circle cx="256" cy="435" r="3" fill="#b8c7cc" />
                </g>
            )}
            {a.outfit === 'hoodie' && (
                <g stroke="#263b49" strokeWidth="2.5" fill="none">
                    <path d="M162 324Q111 329 135 385Q177 417 216 383Q257 417 293 385Q311 335 259 324" />
                    <path d="M185 381L181 447M246 381L248 447M152 490Q211 469 274 490L283 545H145Z" />
                    <circle cx="181" cy="447" r="4" fill="#e2e6d7" />
                    <circle cx="248" cy="447" r="4" fill="#e2e6d7" />
                </g>
            )}
            {a.outfit === 'shirt' && (
                <g fill="#edf3eb" opacity=".8">
                    <path d="M129 349L194 565H214L148 340Z" />
                    <path d="M251 334L313 572H329L270 341Z" />
                    <path d="M66 426H358L360 444H62Z" />
                </g>
            )}
            {a.outfit === 'sweater' && (
                <g stroke="#edf4e7" strokeWidth="3" opacity=".45">
                    <path d="M164 331Q213 387 257 332" fill="none" />
                    {[425, 445, 465, 485].map((y) => (
                        <path key={y} d={`M96 ${y}H326`} />
                    ))}
                </g>
            )}
            <path d="M65 426Q96 443 107 486L109 571H39Z" fill={`url(#${id}shade)`} />
            <path
                d="M318 394Q330 474 322 571M109 397Q97 468 111 571"
                fill="none"
                stroke="#1b303e"
                strokeWidth="3"
                opacity=".55"
            />
            {/* Ears and face. */}
            <g fill={a.skin} stroke="#986b4b" strokeWidth="2.5">
                <path d="M143 186Q114 170 115 206Q119 239 144 233" />
                <path d="M282 186Q310 174 307 208Q304 236 282 232" />
                <path d={face} fill={`url(#${id}skin)`} />
            </g>
            <path
                d="M128 197Q117 188 124 214L134 220M295 194Q307 187 300 215"
                fill="none"
                stroke="#aa7955"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M145 210Q149 264 194 292Q215 310 239 296Q188 326 151 270Z"
                fill="#966244"
                opacity=".12"
            />
            <ellipse cx="164" cy="233" rx="17" ry="9" fill="#de8269" opacity=".18" />
            <ellipse cx="265" cy="233" rx="16" ry="9" fill="#de8269" opacity=".15" />
            {/* Eyes are built from separate lids, whites, iris and glints. */}
            {[171, 253].map((cx, index) => (
                <g key={cx}>
                    <path
                        d={
                            a.eyes === 'round'
                                ? `M${cx - 19} 198Q${cx} 173 ${cx + 19} 199Q${cx} 219 ${cx - 19} 198Z`
                                : a.eyes === 'relaxed'
                                  ? `M${cx - 21} 198Q${cx} 190 ${cx + 19} 198Q${cx} 214 ${cx - 21} 198Z`
                                  : `M${cx - 22} 199Q${cx} 179 ${cx + 19} 198Q${cx} 217 ${cx - 22} 199Z`
                        }
                        fill="#fffaf0"
                    />
                    <ellipse
                        cx={cx + 5}
                        cy="199"
                        rx="8.5"
                        ry={a.eyes === 'relaxed' ? 9 : 12}
                        fill={a.eye_color}
                    />
                    <ellipse cx={cx + 6} cy="199" rx="4.5" ry="8.5" fill="#262727" />
                    <circle cx={cx + 8} cy="194" r="2.5" fill="white" />
                    <path
                        d={`M${cx - 22} 199Q${cx} ${a.eyes === 'relaxed' ? 190 : 179} ${cx + 19} 198`}
                        stroke="#42342a"
                        strokeWidth="3.5"
                        fill="none"
                        strokeLinecap="round"
                    />
                    {a.presentation === 'feminine' && (
                        <path
                            d={`M${cx - 19} 195l-6 -4m9 1l-4 -6`}
                            stroke="#42342a"
                            strokeWidth="2.5"
                        />
                    )}
                    <path
                        d={`M${cx - 23} 175Q${cx} ${a.brows === 'arched' ? 155 : a.brows === 'bold' ? 160 : 165} ${cx + 17} ${index ? 174 : 171}`}
                        stroke={a.hair_color}
                        strokeWidth={a.brows === 'bold' ? 10 : 6}
                        fill="none"
                        strokeLinecap="round"
                    />
                </g>
            ))}
            <path
                d={
                    a.nose === 'straight'
                        ? 'M213 199L209 231L225 234'
                        : a.nose === 'round'
                          ? 'M211 213Q196 237 213 240Q230 241 224 228'
                          : 'M216 204Q216 223 227 230Q218 238 208 233'
                }
                fill="none"
                stroke="#ab7951"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            {a.beard && (
                <path
                    d="M151 249Q177 271 181 253Q211 242 242 253Q257 272 279 244Q269 290 231 304Q189 309 163 276Z"
                    fill={a.hair_color}
                    opacity=".67"
                />
            )}
            {/* Mouth is deliberately static: there is no lip synchronization. */}
            {a.mouth === 'gentle' ? (
                <path
                    d="M191 258Q212 269 234 256"
                    fill="none"
                    stroke="#81513e"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
            ) : (
                <g>
                    <path
                        d={
                            a.mouth === 'wide'
                                ? 'M184 251Q214 266 245 249Q234 288 210 279Q193 277 184 251Z'
                                : 'M191 253Q215 266 241 252Q229 280 212 275Q198 273 191 253Z'
                        }
                        fill="#633d32"
                        stroke="#88543e"
                        strokeWidth="2"
                    />
                    <path d="M192 254Q216 265 240 253L235 261Q215 270 197 262Z" fill="#fffaf1" />
                    <path d="M207 273Q223 265 232 270Q220 280 207 273" fill="#d48277" />
                </g>
            )}
            {a.freckles && (
                <g fill="#a36c47" opacity=".7">
                    {[155, 165, 175, 247, 258, 270].map((x, i) => (
                        <circle key={x} cx={x} cy={229 + (i % 2) * 5} r="1.6" />
                    ))}
                </g>
            )}
            {/* Composable front hairstyles. */}
            <g fill={a.hair_color} stroke="#332c29" strokeWidth="3" strokeLinejoin="round">
                {a.hair === 'swept' && (
                    <>
                        <path d="M134 211L121 179Q96 169 110 144Q92 123 118 109Q104 85 147 83Q170 43 218 65Q260 43 279 83Q323 88 308 122Q327 151 292 172L281 212L270 164L269 121Q250 102 239 128Q220 165 161 158L150 185Z" />
                        <path
                            d="M127 141Q188 135 227 91Q214 132 168 151M146 99Q188 91 207 73M277 97Q292 102 292 122"
                            fill="none"
                            stroke="#a47b50"
                            strokeWidth="7"
                            opacity=".35"
                            strokeLinecap="round"
                        />
                    </>
                )}
                {a.hair === 'curly' && (
                    <>
                        {[
                            [129, 145],
                            [119, 119],
                            [139, 92],
                            [169, 76],
                            [202, 73],
                            [235, 73],
                            [269, 89],
                            [291, 114],
                            [289, 147],
                            [153, 133],
                            [186, 116],
                            [221, 112],
                            [254, 127],
                        ].map(([x, y]) => (
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="26" />
                        ))}
                        <path d="M122 163L135 206L149 164M281 161L285 200L296 158" />
                    </>
                )}
                {(a.hair === 'long' || a.hair === 'braids' || a.hair === 'bob') && (
                    <>
                        <path d="M125 200Q104 108 164 83Q210 59 259 86Q311 103 296 198L278 183L273 137Q231 129 219 99Q200 144 151 153L145 205Z" />
                        <path
                            d="M128 171Q119 107 179 88M286 169Q291 111 251 97"
                            fill="none"
                            stroke="#c39868"
                            strokeWidth="5"
                            opacity=".25"
                        />
                    </>
                )}
                {a.hair === 'short' && (
                    <>
                        <path d="M132 205L117 148L122 105L142 112L145 91L169 99L185 80L208 90L230 78L246 94L268 91L278 111L295 115L295 165L282 207L274 145Q211 159 149 142L146 203Z" />
                        <path
                            d="M148 124Q212 146 275 126"
                            fill="none"
                            stroke="#c39868"
                            strokeWidth="4"
                            opacity=".2"
                        />
                    </>
                )}
            </g>
            {a.glasses !== 'none' && (
                <g fill="#d8f1f1" fillOpacity=".13" stroke="#294858" strokeWidth="4">
                    {a.glasses === 'round' ? (
                        <>
                            <circle cx="170" cy="202" r="26" />
                            <circle cx="254" cy="202" r="26" />
                        </>
                    ) : (
                        <>
                            <rect x="143" y="180" width="55" height="42" rx="10" />
                            <rect x="227" y="180" width="55" height="42" rx="10" />
                        </>
                    )}
                    <path
                        d="M198 198Q212 190 228 198M143 194L129 187M281 194L292 187"
                        fill="none"
                    />
                    <path
                        d="M151 190l10-3M236 190l10-3"
                        stroke="white"
                        strokeWidth="3"
                        opacity=".7"
                    />
                </g>
            )}
            {a.earrings && (
                <g fill="none" stroke="#dfb555" strokeWidth="4">
                    <ellipse cx="128" cy="231" rx="6" ry="10" />
                    <ellipse cx="296" cy="231" rx="6" ry="10" />
                </g>
            )}
            {a.necklace && (
                <g fill="none" stroke="#d9ba69" strokeWidth="3">
                    <path d="M175 335Q208 417 248 338" />
                    <path d="M210 383l-6 9l7 10l7-10Z" fill="#e1c773" />
                </g>
            )}
            {a.hat === 'cap' && (
                <g fill={a.clothing_color} stroke="#263b49" strokeWidth="3">
                    <path d="M118 129Q105 52 205 51Q293 49 296 120L264 128Q190 110 118 129Z" />
                    <path d="M118 126Q201 96 288 122L320 145Q264 143 234 136Q169 120 118 132Z" />
                    <path d="M211 53Q189 81 190 114" fill="none" opacity=".4" />
                </g>
            )}
            {a.hat === 'beanie' && (
                <g fill={a.clothing_color} stroke="#263b49" strokeWidth="3">
                    <path d="M117 126Q105 51 210 49Q307 50 299 133Z" />
                    <path d="M113 116Q204 95 300 117L299 150Q211 129 115 151Z" />
                    {[145, 170, 195, 220, 245, 270].map((x) => (
                        <path key={x} d={`M${x} 119v22`} opacity=".3" />
                    ))}
                </g>
            )}
        </svg>
    );
}
