import { useId } from 'react';
import type { Scene as SceneType } from '../models/types';

export function Scene({ scene, className = '' }: { scene: SceneType; className?: string }) {
    const id = useId().replace(/:/g, '');
    const pink = scene === 'candy' || scene === 'kyoto';
    const night = scene === 'theme';
    const indoor = scene === 'therapy';
    const tree = (x: number, y: number, scale = 1, tint = '#61a77c') => (
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
            <path d="M-18 190L-12 51L-48 13L-37 9L-3 49L27-3L39 4L13 65L22 190Z" fill="#67816c" />
            <g className="tree-leaves" fill={tint}>
                <ellipse cx="-38" cy="0" rx="66" ry="52" />
                <ellipse cx="28" cy="-29" rx="72" ry="56" />
                <ellipse cx="66" cy="17" rx="62" ry="48" />
                <ellipse cy="35" rx="76" ry="51" />
            </g>
            <path
                d="M-42 2Q-7-13 24-38M35 32L57 17"
                stroke="#dded9a"
                strokeWidth="5"
                opacity=".27"
                strokeLinecap="round"
            />
        </g>
    );
    const flower = (x: number, y: number, color = '#fff7d1') => (
        <g transform={`translate(${x} ${y})`} className="flower">
            <path
                d="M0 0L-2 24M-2 16Q-18 3-16 15Z"
                stroke="#529065"
                strokeWidth="3"
                fill="#78ac75"
            />
            <g fill={color}>
                {[0, 60, 120].map((r) => (
                    <ellipse key={r} rx="4" ry="10" transform={`rotate(${r})`} />
                ))}
            </g>
            <circle r="3" fill="#e9bc55" />
        </g>
    );
    return (
        <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            className={`scene ${className}`}
            role="img"
            aria-label={`Cenário ${scene}`}
        >
            <defs>
                <linearGradient id={`${id}sky`} x2="0" y2="1">
                    <stop stopColor={night ? '#415578' : pink ? '#efdde9' : '#aedfee'} />
                    <stop offset="1" stopColor={night ? '#a5b2bd' : '#f3f7df'} />
                </linearGradient>
                <linearGradient id={`${id}water`} x2="0" y2="1">
                    <stop stopColor="#9bcac7" />
                    <stop offset="1" stopColor="#78b6b7" />
                </linearGradient>
                <linearGradient id={`${id}ground`} x2="0" y2="1">
                    <stop stopColor={pink ? '#b9cba5' : '#adca83'} />
                    <stop offset="1" stopColor={pink ? '#d8d5a7' : '#d5dfa0'} />
                </linearGradient>
            </defs>
            <rect width="1440" height="900" fill={`url(#${id}sky)`} />
            {!indoor && (
                <>
                    <circle cx="1140" cy="152" r="57" fill="#fff6cf" opacity=".8" />
                    <g className="clouds" fill="white" opacity=".65">
                        <path d="M100 140q12-35 48-19q20-41 57-7q40-9 47 25Z" />
                        <path d="M650 196q7-27 35-19q23-49 54-12q28-14 42 30Z" />
                        <path d="M1000 290q18-36 55-17q24-48 63-12q35-4 41 27Z" />
                    </g>
                    <path
                        d="M0 465Q200 332 430 459Q680 345 943 451Q1187 356 1440 445V900H0Z"
                        fill="#94bca4"
                        opacity=".65"
                    />
                    <g fill="#c2d3c8" opacity=".85">
                        {[540, 580, 625, 670, 730, 775, 830].map((x, i) => (
                            <g key={x}>
                                <path d={`M${x} 492V${392 - (i % 3) * 26}l15-16 15 16v100Z`} />
                                <path
                                    d={`M${x + 6} 420v8m14-8v8m-14 10v8m14-8v8`}
                                    stroke="#89aaa3"
                                    strokeWidth="3"
                                />
                            </g>
                        ))}
                    </g>
                    <path
                        d="M0 558Q200 500 420 545Q720 486 1000 551Q1260 485 1440 535V900H0Z"
                        fill={`url(#${id}ground)`}
                    />
                    <path
                        d="M0 632Q390 550 780 595T1440 583V727Q1010 685 630 727T0 713Z"
                        fill={`url(#${id}water)`}
                    />
                    <g fill="none" stroke="#e3f3df" opacity=".45" strokeWidth="3">
                        <path d="M200 643h170m270-23h130m245 46h202M123 689h92m352-15h169m287 32h149" />
                        <path d="M810 647h78m266-31h100" />
                    </g>
                    <path
                        d="M0 778Q470 682 796 758T1440 733V900H0Z"
                        fill={pink ? '#c5d3a1' : '#bfce8d'}
                    />
                    <path
                        d="M994 900Q899 780 1067 737L1174 745Q1002 801 1231 900Z"
                        fill="#e9d7b2"
                        opacity=".75"
                    />
                </>
            )}
            {(scene === 'park' || scene === 'paris') && (
                <>
                    {tree(120, 326, 2.1, '#6fa77a')}
                    {tree(1320, 359, 2.2, '#73a77d')}
                    {tree(347, 465, 0.65, '#93b27c')}
                    {tree(1060, 474, 0.7, '#8cae77')}
                    <g
                        transform="translate(140 662)"
                        stroke="#6e7d6c"
                        strokeWidth="8"
                        fill="#b39470"
                    >
                        <path d="M0 10H165V29H0ZM0-12H165V2H0Z" />
                        <path d="M9 29v38m146-38v38M-4 38h176" fill="none" />
                    </g>
                    <g
                        transform="translate(320 432)"
                        fill="#516f6d"
                        stroke="#516f6d"
                        strokeWidth="6"
                    >
                        <path d="M0 0V259M-19 255H19" />
                        <path d="M-22-49H22L16-3H-15Z" fill="#f7eac3" />
                        <path d="M-28-49L0-72L28-49ZM-15-2H15" />
                        <circle cy="-77" r="5" />
                    </g>
                    {scene === 'paris' && (
                        <g
                            transform="translate(660 210)"
                            fill="none"
                            stroke="#8a9284"
                            strokeWidth="8"
                            opacity=".85"
                        >
                            <path d="M0 0Q-5 164-78 323H-48Q-30 261 0 260Q30 261 48 323H78Q5 164 0 0Z" />
                            <path
                                d="M-39 222H39M-24 169H24M-12 100H12M-53 250H53M0-20V0M-34 222L24 169M34 222L-24 169M-48 250L39 222M48 250L-39 222"
                                strokeWidth="5"
                            />
                        </g>
                    )}
                </>
            )}
            {scene === 'therapy' && (
                <>
                    <rect width="1440" height="650" fill="#efe9db" />
                    <rect y="650" width="1440" height="250" fill="#d0b895" />
                    <g stroke="#c0a989" strokeWidth="2" opacity=".5">
                        {[740, 825, 890].map((y) => (
                            <path key={y} d={`M0 ${y}H1440`} />
                        ))}
                        <path d="M300 650L150 900M800 650L900 900M1200 650L1440 900" />
                    </g>
                    <rect
                        x="100"
                        y="93"
                        width="430"
                        height="407"
                        rx="120"
                        fill="#c9e3dc"
                        stroke="#d1c5ac"
                        strokeWidth="20"
                    />
                    <path d="M315 95V500M100 300H530" stroke="#f7f3e9" strokeWidth="13" />
                    <g fill="#d9cfb6">
                        <path d="M76 70H120V520H76ZM509 70H552V520H509Z" />
                    </g>
                    <ellipse cx="830" cy="784" rx="420" ry="83" fill="#e4ddcb" />
                    <g fill="#82a99b" stroke="#658f86" strokeWidth="4">
                        <rect x="790" y="434" width="470" height="258" rx="65" />
                        <rect x="775" y="588" width="500" height="142" rx="45" />
                        <rect x="740" y="510" width="90" height="225" rx="33" />
                        <rect x="1220" y="510" width="90" height="225" rx="33" />
                        <path d="M1017 455V620" fill="none" />
                    </g>
                    <rect
                        x="858"
                        y="470"
                        width="110"
                        height="114"
                        rx="20"
                        fill="#d4d9ac"
                        transform="rotate(-10 913 527)"
                    />
                    <rect
                        x="1070"
                        y="473"
                        width="114"
                        height="105"
                        rx="20"
                        fill="#e0ba93"
                        transform="rotate(9 1127 526)"
                    />
                    <g transform="translate(1290 460)">
                        <path d="M0 160V-130" stroke="#64846a" strokeWidth="6" />
                        {[-70, 0, 65].map((y, i) => (
                            <g key={y} fill={i % 2 ? '#80aa73' : '#609578'}>
                                <ellipse
                                    cx="-28"
                                    cy={y}
                                    rx="42"
                                    ry="19"
                                    transform={`rotate(30 -28 ${y})`}
                                />
                                <ellipse
                                    cx="29"
                                    cy={y - 32}
                                    rx="42"
                                    ry="19"
                                    transform={`rotate(-30 29 ${y - 32})`}
                                />
                            </g>
                        ))}
                        <path d="M-50 137H50L35 239H-32Z" fill="#ca9c7b" />
                    </g>
                    <g transform="translate(663 230)">
                        <path d="M0 110V465M-50 465H50" stroke="#8f8172" strokeWidth="9" />
                        <path d="M-50 0H50L88 120H-88Z" fill="#f4d99e" />
                        <ellipse cy="122" rx="88" ry="12" fill="#fff0bf" />
                    </g>
                    <rect
                        x="905"
                        y="155"
                        width="180"
                        height="180"
                        rx="10"
                        fill="#faf6ec"
                        stroke="#c1ab8e"
                        strokeWidth="10"
                    />
                    <path d="M935 305Q961 204 1056 190Q1049 288 935 305" fill="#8ebca0" />
                    <path d="M936 306L1033 212" stroke="#f2efd9" strokeWidth="4" />
                </>
            )}
            {scene === 'candy' && (
                <>
                    {tree(100, 350, 1.8, '#e8a4b3')}
                    {tree(1350, 340, 1.9, '#b4a2d1')}
                    {[270, 1070, 1260].map((x, i) => (
                        <g key={x} transform={`translate(${x} ${470 + i * 20})`}>
                            <path d="M0 0V210" stroke="#fdf5df" strokeWidth="17" />
                            <circle
                                r="66"
                                fill={i % 2 ? '#8acbc3' : '#e9a8b5'}
                                stroke="#fff5e1"
                                strokeWidth="10"
                            />
                            <path
                                d="M0-43Q60-15 19 25Q-20 60-38 5Q-47-30 0-20Q25-12 8 5"
                                fill="none"
                                stroke="#fff4dd"
                                strokeWidth="10"
                                strokeLinecap="round"
                            />
                        </g>
                    ))}
                    <path d="M780 566V467L900 369L1019 467V567Z" fill="#f0c2a8" />
                    <path
                        d="M757 468L900 348L1045 468"
                        fill="#d795ad"
                        stroke="#f4e0ca"
                        strokeWidth="16"
                    />
                    <path d="M877 568V511Q900 479 925 511V568" fill="#ad90ad" />
                </>
            )}
            {scene === 'theme' && (
                <>
                    <g
                        transform="translate(900 320)"
                        fill="#c9b7d5"
                        stroke="#958eaf"
                        strokeWidth="3"
                    >
                        <path d="M-110 280V99H110V280Z" />
                        <path d="M-145 280V80H-70V280M70 280V80H145V280" />
                        <path d="M-165 80L-108-12L-51 80ZM51 80L108-12L165 80Z" fill="#7d88b3" />
                        <path d="M-42 99V-8H42V99ZM-63-8L0-110L63-8Z" />
                        <path d="M0-110V-149L39-135L0-124" fill="#e3ba74" />
                        <path d="M-29 280V216Q0 172 29 216V280" fill="#e6c789" />
                    </g>
                    <g fill="none" stroke="#e4d9af" opacity=".9">
                        <path d="M0 260Q720 550 1440 260" strokeWidth="3" />
                        {[80, 230, 380, 530, 680, 830, 980, 1130, 1280].map((x, i) => (
                            <circle
                                className="light"
                                key={x}
                                cx={x}
                                cy={280 + Math.sin((x / 1440) * Math.PI) * 125}
                                r="7"
                                fill={i % 2 ? '#ffdfa2' : '#f7c7b1'}
                            />
                        ))}
                    </g>
                    {tree(100, 340, 1.6, '#5d8e81')}
                    {tree(1300, 400, 1.4, '#598c82')}
                </>
            )}
            {scene === 'kyoto' && (
                <>
                    {tree(110, 320, 2, '#dba3b1')}
                    {tree(1320, 350, 2.2, '#e6b0bf')}
                    <g transform="translate(880 460)">
                        <path d="M-65 140V-110M65 140V-110" stroke="#b16958" strokeWidth="19" />
                        <path
                            d="M-120-98Q0-72 120-98M-100-50H100"
                            stroke="#ad5d50"
                            strokeWidth="21"
                            fill="none"
                        />
                        <path
                            d="M-135-108Q0-76 135-108"
                            stroke="#615c52"
                            strokeWidth="8"
                            fill="none"
                        />
                    </g>
                    <path
                        d="M1040 654Q1180 568 1320 654"
                        stroke="#a87767"
                        strokeWidth="20"
                        fill="none"
                    />
                    <path
                        d="M1055 626Q1180 538 1305 626M1080 615V653M1130 591V630M1180 584V620M1230 591V630M1280 615V653"
                        stroke="#bb8b77"
                        strokeWidth="6"
                        fill="none"
                    />
                    <g fill="#f6d9df" className="petals">
                        {[170, 340, 750, 1100, 1260].map((x, i) => (
                            <ellipse
                                key={x}
                                cx={x}
                                cy={260 + i * 65}
                                rx="5"
                                ry="10"
                                transform={`rotate(${i * 25} ${x} ${260 + i * 65})`}
                            />
                        ))}
                    </g>
                </>
            )}
            {!indoor && (
                <>
                    {flower(1220, 792)}
                    {flower(1260, 805, '#f3d5dc')}
                    {flower(1170, 813)}
                    {flower(260, 823)}
                    {flower(294, 840, '#eed7a6')}
                    <g fill="#709d71" opacity=".65">
                        <path d="M30 900Q40 815 49 899Q62 830 64 900M1370 900Q1380 804 1390 900Q1410 826 1410 900" />
                    </g>
                </>
            )}
            <rect width="1440" height="900" fill="#f6f3db" opacity=".055" />
        </svg>
    );
}
