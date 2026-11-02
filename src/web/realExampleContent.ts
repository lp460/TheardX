import type { ArticleBlock, Segment } from '@/types/model';

/**
 * Public-only, static reading samples extracted from the owner's saved X/Reddit posts.
 * Never add notes, private collections, personal tags, favorites, read-state or sync metadata.
 * The author-written text remains in its original language. Truncated captures are flagged.
 */
export type PublicCapturedPost = {
  id: string;
  author: string;
  handle: string;
  url: string;
  text?: Segment[];
  blocks?: ArticleBlock[];
  card?: { url: string; title?: string };
  truncated?: boolean;
  comment?: boolean;
  depth?: number;
  media?: { url: string; alt?: string }[];
};

export const realExampleContent: Record<string, PublicCapturedPost[]> = {
  "inoino": [
    {
      "id": "2116582365950832793",
      "author": "inoino",
      "handle": "inoino65536",
      "url": "https://x.com/inoino65536/status/2116582365950832793",
      "text": [
        {
          "t": "text",
          "v": "I've released a free, open-source speech input app similar to Aq◯aVo◯ce!\n\nIt's a Windows speech input app specialized for Japanese called \"OpenHinoVoice.\"\n\nStart recording with a shortcut key, and when you're done speaking, hit Enter. It handles everything in one seamless operation, from transcription to AI-powered text refinement and insertion into the input field.\n\nFor short utterances, transcription is nearly instant, and even with AI refinement, it's about 5 seconds! (Varies depending on utterance length and environment)\n\n【Main Features】\n\n・Runs the Japanese-specialized model \"Haas-ja-v1.0\" with speech.cpp for fully local speech recognition\n・Supports ChatGPT login! Use AI refinement without an API key\n・Choose your AI for refinement, such as OpenAI API or OpenAI-compatible APIs\n・AI corrects filler words, adds punctuation, fixes misrecognitions, and shapes it into natural text\n・If you hit Enter again during AI refinement, you can confirm the raw text without waiting\n・The recognized text is directly inserted into the input field of the app you're currently using\n・Customizable settings for recording shortcut keys, recognition vocabulary hints, max recording time, etc.\n\n【Design Philosophy We Focused On】\n\nThe goal was to create a \"speech input tool that doesn't rely on specific cloud services or AI models.\"\nWe separated speech recognition from text refinement, with recognition handled entirely on your PC. Refinement is delegated to your preferred AI only when needed.\nIt works for speech input even without AI, and if you don't want to wait for refinement, you can switch to raw text.\nIn other words, you can mix and match for speed, cost, privacy, and text quality based on your needs.\n\n【Differences from Existing Speech Input Tools】\n\nUnlike cloud-based speech input services, it doesn't send audio data externally—recognition happens locally. No monthly fees for speech recognition either.\n\nUnlike Whisper-based local speech input tools, it uses the Japanese-specialized Haas-ja-v1.0 with speech.cpp.\n\nWe prioritized not just the recognition engine, but also the ability to choose models and endpoints for AI refinement—and the fact that it works with the same operations even without refinement.\n\n【Of Course, Free and Open Source】\n\nThe app itself is built with everyone's favorite Rust. Source code is available under the MIT license.\n\nIt's free to use, and you can read the code, modify it, or customize it to your liking.\n\n*Speech recognition is fully local. When using external AI for refinement, only the recognized text is sent to the selected service. The terms and fees of the AI service apply separately.\n\nGive it a try!\n\n↓ GitHub Repository (in the replies)"
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116582222820171776/img/mZNbA3xpBxXADK6Q.jpg"
        }
      ]
    },
    {
      "id": "2116582368211521782",
      "author": "inoino",
      "handle": "inoino65536",
      "url": "https://x.com/inoino65536/status/2116582368211521782",
      "card": {
        "url": "https://t.co/IZfvT2CHG9",
        "title": "github.com GitHub - iiinno/OpenHinoVoice: Windows で使う日本語の音声入力アプリ。認識はローカル、整形は ChatGPT / OpenCode Go / OpenAI... Windows で使う日本語の音声入力アプリ。認識はローカル、整形は ChatGPT / OpenCode Go / OpenAI から選べる - iiinno/OpenHinoVoice"
      }
    }
  ],
  "oliver": [
    {
      "id": "2116561474244210785",
      "author": "Oliver",
      "handle": "oliviscusAI",
      "url": "https://x.com/oliviscusAI/status/2116561474244210785",
      "text": [
        {
          "t": "text",
          "v": "A 4B model can generate interactive 3D scenes with Three.js 🤯\n\nIt’s called Qwen3.5-4B-3D-Coder. Describe a scene in chat, and it generates the HTML and JavaScript.\n\n- Full FP16 weights, dataset and technical report available\n- Trained on 4,146 synthetic examples in about 60 hours\n- Q4_K_M and Q8_0 GGUF versions available\n- Runs through chat, without agent tools\n\nUse the provided Three.js system prompt and generation settings to get started."
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/media/HV-JNTBbQAAYhTD?format=jpg&name=large"
        }
      ]
    },
    {
      "id": "2116561481529704461",
      "author": "Oliver",
      "handle": "oliviscusAI",
      "url": "https://x.com/oliviscusAI/status/2116561481529704461",
      "text": [
        {
          "t": "text",
          "v": "link: "
        },
        {
          "href": "https://t.co/9QshmbQqP1",
          "t": "link",
          "v": "https://\nhuggingface.co/ccore/Qwen3.5-\n4B-3D-Coder\n…"
        },
        {
          "t": "text",
          "v": "\n\nfollow for more useful tools like this."
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/media/HV-JcaHacAAsarU?format=jpg&name=large"
        }
      ]
    }
  ],
  "reddit-zelda": [
    {
      "id": "t3_1xd9hjc",
      "author": "Caf_fein",
      "handle": "Caf_fein",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/zelda_botw_native_port_on_8gb_base_m1_mac/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Finally tried the Zelda port on my Mac! It took me about 30 minutes to get it working."
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "b": true,
              "t": "text",
              "v": "Here’s my review:"
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "It works great on the base M1 Mac and delivers much more stable and better performance than any emulator out there."
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "b": true,
              "t": "text",
              "v": "Note:"
            },
            {
              "t": "text",
              "v": " It runs at close to 60 FPS, but the frame rate drops due to thermal throttling, so I capped it at a stable 30 FPS. The graphics look fantastic, with no visible bugs."
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "I'm not able to change the aspect ratio for now, but this may get fixed in a future update."
            }
          ]
        }
      ],
      "media": [
        {
          "url": "https://i.redd.it/a6h98qsss6xh1.png"
        },
        {
          "url": "https://i.redd.it/esrx1boxq6xh1.png"
        }
      ]
    },
    {
      "id": "t1_19rj8j07dz4qr",
      "author": "Structure-These",
      "handle": "Structure-These",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj8j07dz4qr/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Why is no one targeting tears of the kingdom??"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rj9as8m1p6o",
      "author": "Caf_fein",
      "handle": "Caf_fein",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj9as8m1p6o/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Github repo also works on TOTK"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rjagzfbngsg",
      "author": "Armand9x",
      "handle": "Armand9x",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rjagzfbngsg/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "iPhone 17 pro max:"
            }
          ]
        },
        {
          "media": {
            "alt": "media poster",
            "kind": "photo",
            "url": "https://preview.redd.it/0r2f60eyz7xh1.jpg?vthumb=1&s=9e426352968bb1004584b398e0ad909e5772eff5"
          },
          "t": "image"
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rj8v6dnre85",
      "author": "AlxAlxC",
      "handle": "AlxAlxC",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj8v6dnre85/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Is it difficult to install? Or just couple terminal comands, put files in folder and lets go?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rj9buqpyapt",
      "author": "Caf_fein",
      "handle": "Caf_fein",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj9buqpyapt/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Its very easy, few terminal cmds only. Use AI for it"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rj0b7g8dz9d",
      "author": "FinestKind90",
      "handle": "FinestKind90",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj0b7g8dz9d/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "How are save games managed?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rj01lrlr6pw",
      "author": "Sharp_Ad5783",
      "handle": "Sharp_Ad5783",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj01lrlr6pw/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Is there a benefit to running this instead of just the emulator?"
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "I assume the performance should be better if its a native port, or is this just essentially the game wrapped in an emulator?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rj0543be5s5",
      "author": "LaZZyBird",
      "handle": "LaZZyBird",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj0543be5s5/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Better performance, CPU instructions runs natively, GPU runs straight through Metal."
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Imagine if someone looked at a Switch game, took every instruction that differs between a Switch and a Mac, then stitch them together individually like a maniac."
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rj0p4uawvyc",
      "author": "Caf_fein",
      "handle": "Caf_fein",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj0p4uawvyc/",
      "blocks": [
        {
          "media": {
            "alt": "media poster",
            "kind": "photo",
            "url": "https://preview.redd.it/q66p3u4kw6xh1.jpg?vthumb=1&s=ad04d2157c0b9dd52ac09b5e9210d26b5ccfc807"
          },
          "t": "image"
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Here is a video of the game running on an emulator. There is a huge performance gap"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rj0tyqu6coy",
      "author": "Marcopanii_1",
      "handle": "Marcopanii_1",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj0tyqu6coy/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Can you post a video of the native port in action?"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_19rj2gvisoczn",
      "author": "Lanky-Violinist7394",
      "handle": "Lanky-Violinist7394",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj2gvisoczn/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "that’s switch version. Wii U’s one on latest CEMU runs much, much better."
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_19rj07huhngec",
      "author": "SnooMaps7046",
      "handle": "SnooMaps7046",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj07huhngec/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Repo has Ryujinx, so its questionable if its even native"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rj2ktjkcfyd",
      "author": "TabletopParlourPalm",
      "handle": "TabletopParlourPalm",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj2ktjkcfyd/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "From the description, it only uses Ryujinx's shader translator."
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_19rizusnx6ksh",
      "author": "Particular_Switch_21",
      "handle": "Particular_Switch_21",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rizusnx6ksh/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Is there a github link for the port?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rizxnpmdvpe",
      "author": "Caf_fein",
      "handle": "Caf_fein",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rizxnpmdvpe/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "href": "https://github.com/ly05010419/MacNativeGames/tree/main",
              "t": "link",
              "v": "https://github.com/ly05010419/MacNativeGames/tree/main"
            },
            {
              "t": "text",
              "v": " I used this repo"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rj2pf73xio0",
      "author": "Grand_Sprinkles_2094",
      "handle": "Grand_Sprinkles_2094",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj2pf73xio0/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "We eating good"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rj164v3jk5h",
      "author": "Dependent_Big4372",
      "handle": "Dependent_Big4372",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj164v3jk5h/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "can you post a video?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rj1b1tsbttu",
      "author": "Caf_fein",
      "handle": "Caf_fein",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj1b1tsbttu/",
      "blocks": [
        {
          "media": {
            "alt": "media poster",
            "kind": "photo",
            "url": "https://preview.redd.it/b4uf9rl3z6xh1.jpg?vthumb=1&s=ff57e11db7bc909a6055f46f317550fc4753727b"
          },
          "t": "image"
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "here's the video"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rj2zw2qnxkz",
      "author": "Dependent_Big4372",
      "handle": "Dependent_Big4372",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj2zw2qnxkz/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "nice"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_19rj0bixl335v",
      "author": "AutarchOfReddit",
      "handle": "AutarchOfReddit",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj0bixl335v/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "href": "https://www.reddit.com/user/Caf_fein/",
              "t": "link",
              "v": "u/Caf_fein"
            },
            {
              "t": "text",
              "v": " Very impressive, but I will wait until you bring along a dmg installer."
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rj0pwzpgw5g",
      "author": "Uhh_JustADude",
      "handle": "Uhh_JustADude",
      "url": "https://www.reddit.com/r/macgaming/comments/1xd9hjc/comment/19rj0pwzpgw5g/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Could have been playing this whole time? Just bought a Switch 2 and the game this year."
            }
          ]
        }
      ],
      "comment": true
    }
  ],
  "benji": [
    {
      "id": "2116593247854453244",
      "author": "Benji Taylor",
      "handle": "benjitaylor",
      "url": "https://x.com/benjitaylor/status/2116593247854453244",
      "text": [
        {
          "t": "text",
          "v": "Stageshow: a skill that helps your agent make better faux UI stills, animations, bento grids, and more. \n\nnpx skills add benjitaylor/skills --skill stageshow"
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116591037816971264/img/646-9xgMoEXyzL8m.jpg"
        }
      ]
    },
    {
      "id": "2116593631876554755",
      "author": "Benji Taylor",
      "handle": "benjitaylor",
      "url": "https://x.com/benjitaylor/status/2116593631876554755",
      "text": [
        {
          "t": "text",
          "v": "Models can do these now, but they may look heavy-handed, lack smooth animations, or simply don’t make sense. With Stageshow, the same prompts can produce far better results. \n\nEg. Before and after..."
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116593352754053120/img/uVZnqwD7geePLl2p.jpg"
        }
      ]
    },
    {
      "id": "2116593805441077506",
      "author": "Benji Taylor",
      "handle": "benjitaylor",
      "url": "https://x.com/benjitaylor/status/2116593805441077506",
      "text": [
        {
          "t": "text",
          "v": "The skill walks the agent through how I'd make one by hand, from picking the look and and planning the story in a few beats to starting from a solid example, then has it film the result and fix what it finds."
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116593771437871104/img/THlOIM-H5x31m-C9.jpg"
        }
      ]
    },
    {
      "id": "2116594018998202724",
      "author": "Benji Taylor",
      "handle": "benjitaylor",
      "url": "https://x.com/benjitaylor/status/2116594018998202724",
      "text": [
        {
          "t": "text",
          "v": "One way I tested it was by recreating small moments from apps I use daily, like Figma, Gmail, Finder and Spotify, etc. I found Stageshow to consistently outperform the same prompts that didn’t have the skill."
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116593973401956352/img/1YHXUqgx8tTy01s-.jpg"
        }
      ]
    },
    {
      "id": "2116594195096011138",
      "author": "Benji Taylor",
      "handle": "benjitaylor",
      "url": "https://x.com/benjitaylor/status/2116594195096011138",
      "text": [
        {
          "t": "text",
          "v": "As model taste improves, I suspect it won’t be long until this skill is no longer needed. With that said, every demo made with it is a small, well-built example of this kind of UI, which is the sort of thing models learn from. So if it plays a small part in making itself"
        }
      ],
      "card": {
        "url": "https://t.co/dPUri39SMH",
        "title": "Stageshow"
      },
      "truncated": true
    }
  ],
  "samuel": [
    {
      "id": "2115881491645554870",
      "author": "Samuel Zeng",
      "handle": "SamuelZengML",
      "url": "https://x.com/SamuelZengML/status/2115881491645554870",
      "text": [
        {
          "t": "text",
          "v": "Introducing Audio8-TTS-Realistic, "
        },
        {
          "handle": "Edge0_AI",
          "t": "mention",
          "v": "@Edge0_AI"
        },
        {
          "t": "text",
          "v": "’s new open-weight speech model: realistic, zero-shot voice cloning in just 0.6B parameters.\n\n• Human-like prosody and expressive delivery\n• Clones a voice from one short clip, in 23 languages\n• 601M params: small enough to fine-tune and serve affordably\n\nCurrently #1 on the Hugging Face TTS Arena, where people vote blind on which voice sounds more human.\n\nOpen weights are available now on "
        },
        {
          "handle": "huggingface",
          "t": "mention",
          "v": "@huggingface"
        },
        {
          "t": "text",
          "v": ". Try it free."
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2115881402164277248/img/3bN549RRGfSFYszG.jpg"
        }
      ]
    },
    {
      "id": "2115881504102551856",
      "author": "Samuel Zeng",
      "handle": "SamuelZengML",
      "url": "https://x.com/SamuelZengML/status/2115881504102551856",
      "text": [
        {
          "t": "text",
          "v": "Audio8-TTS-Realistic is now open source.\n\n🤗 Weights: "
        },
        {
          "href": "https://t.co/YBFkivV58i",
          "t": "link",
          "v": "https://\nhuggingface.co/Edge0/Audio8-T\nTS-Realistic-0.6b\n…"
        },
        {
          "t": "text",
          "v": "\n📄 Paper: "
        },
        {
          "href": "https://t.co/cxFloeuBqX",
          "t": "link",
          "v": "https://\narxiv.org/abs/2610.14776"
        },
        {
          "t": "text",
          "v": "\n🎧 Samples: "
        },
        {
          "href": "https://t.co/qwMSe9DnWR",
          "t": "link",
          "v": "https://\nedge0-ai.github.io/Audio8_TTS/rea\nlistic-0.6b\n…"
        },
        {
          "t": "text",
          "v": "\n💻 Code: "
        },
        {
          "href": "https://t.co/bArhoJpgLZ",
          "t": "link",
          "v": "https://\ngithub.com/Edge0-AI/Audio\n8_TTS\n…"
        },
        {
          "t": "text",
          "v": "\n▶️ Playground: "
        },
        {
          "href": "https://t.co/BYaWAua3jR",
          "t": "link",
          "v": "https://\nhuggingface.co/spaces/Edge0/A\nudio8-TTS-Realistic-0.6b\n…"
        }
      ],
      "card": {
        "url": "https://t.co/YBFkivV58i",
        "title": "Edge0/Audio8-TTS-Realistic-0.6b · Hugging Face"
      }
    },
    {
      "id": "2115881522503045198",
      "author": "Samuel Zeng",
      "handle": "SamuelZengML",
      "url": "https://x.com/SamuelZengML/status/2115881522503045198",
      "text": [
        {
          "t": "text",
          "v": "How it learns to sound human:\n\nTTS is usually trained on two things: the right words (WER) and the right voice (similarity).\n\nBut neither captures rhythm, pauses, or timing.\n\nSo we trained a realism critic that scores each output against a real person saying the same sentence in"
        }
      ],
      "truncated": true,
      "media": [
        {
          "url": "https://pbs.twimg.com/media/HV0fCCOa4AAS7Ft?format=jpg&name=large"
        }
      ]
    },
    {
      "id": "2115881537925529655",
      "author": "Samuel Zeng",
      "handle": "SamuelZengML",
      "url": "https://x.com/SamuelZengML/status/2115881537925529655",
      "text": [
        {
          "t": "text",
          "v": "How it stacks up at 0.6B:\n\n• CV3 (9 languages): 4.86% error — ahead of CosyVoice3-1.5B (6.89%), Qwen3-TTS-1.7B (7.73%), and VoxCPM2 (5.35%)\n• MiniMax (24 languages): 5.89% error — vs. 27.41% for Qwen3-TTS-1.7B\n• Runs in ~1.1 GB RAM on an Apple M2 CPU (INT4)\n\nLarger 4–8B models"
        }
      ],
      "truncated": true,
      "media": [
        {
          "url": "https://pbs.twimg.com/media/HV0fC9OaAAIXY5S?format=jpg&name=large"
        }
      ]
    }
  ],
  "reddit-mario": [
    {
      "id": "t3_1x9stzj",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/mario_kart_8_running_on_an_ipad_a16_with_no_frame/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Device: iPad A16\nGame: Mario Kart 8 with newest updates and DLC\nEmulator: EspressU v1.0\niPadOS: 27.0"
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Mario Kart 8 is running with stable 60 fps on an iPad A16 using the EspressU Emulator. I used a PS5 controller for playing the game. EspressU is a Wii U emulator."
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "No pirated games were used. All games shown are legally owned"
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "AI was used during development of the app."
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Download: "
            },
            {
              "href": "https://discord.gg/espressu",
              "t": "link",
              "v": "https://discord.gg/espressu"
            }
          ]
        }
      ],
      "media": [
        {
          "url": "https://external-preview.redd.it/mario-kart-8-running-on-an-ipad-a16-with-no-frame-drops-v0-dTc1ZzRlYXFkZXdoMXimuQQ0ARP-OCzCt5u_tlCCftIKesIsNQkspLnKK7AT.jpeg?width=640&crop=smart&format=pjpg&auto=webp&s=c7a6749576586b4c4c9e2971c6040220c6369a47"
        }
      ]
    },
    {
      "id": "t1_pho01q5",
      "author": "therealcaner",
      "handle": "therealcaner",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho01q5/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Jit erfordlich?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_pho07kt",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho07kt/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "It has built in JIT and a pairing file generator, you wont need a computer for anything"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_pho2050",
      "author": "therealcaner",
      "handle": "therealcaner",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho2050/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Thank you, installed and worked smooth. Wish they could release on TestFlight or something like iCube but awesome emulator!!!"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_pho2dj9",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho2dj9/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "i could release it on testflight but i think JIT wont work"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 3
    },
    {
      "id": "t1_pho2nlk",
      "author": "therealcaner",
      "handle": "therealcaner",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho2nlk/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Just try better than nothing!👍"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 4
    },
    {
      "id": "t1_phu93f7",
      "author": "jojomortal",
      "handle": "jojomortal",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phu93f7/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "se pedir par ao emulador gerar um arquivo de emparelhamento os outros aplicativos que já usam meu arquivo vai parar de funcionar?"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_phuqn8q",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phuqn8q/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "they will still work"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 3
    },
    {
      "id": "t1_pho40dg",
      "author": "PhilosophyFew2984",
      "handle": "PhilosophyFew2984",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho40dg/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Botw?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_pho592d",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho592d/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "also runs but its harder to handle"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_pho93qt",
      "author": "Hugott",
      "handle": "Hugott",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho93qt/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Do you think it can run locked to 30fps without oveerheating?"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_phoax20",
      "author": "MKTAB_",
      "handle": "MKTAB_",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phoax20/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "30-20fps on A15 chip, use that as your baseline for performance"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 3
    },
    {
      "id": "t1_php83ch",
      "author": "richer2003",
      "handle": "richer2003",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/php83ch/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "With FPS++ I get locked 30fps on my 17 Pro Max. Haven’t noticed any issues with overheating"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 3
    },
    {
      "id": "t1_phox7dw",
      "author": "Mundane-Tangerine234",
      "handle": "Mundane-Tangerine234",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phox7dw/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "EspressU consegue ser melhor que o melocafe, incrível né"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_pho7rxh",
      "author": "Just-A-Random-ID",
      "handle": "Just-A-Random-ID",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pho7rxh/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "AOT could remove the jit dependency and enhance the performance of the game"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phob7uk",
      "author": "AydenGooden",
      "handle": "AydenGooden",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phob7uk/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Didn’t know a anime could remove jit"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_phoc4st",
      "author": "Just-A-Random-ID",
      "handle": "Just-A-Random-ID",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phoc4st/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "🤣\nAot is ahead of time compilation"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_phpgcia",
      "author": "VegetableDeparture21",
      "handle": "VegetableDeparture21",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phpgcia/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "I wish somebody does this, but with nintendo switch"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phpipju",
      "author": "S7zy",
      "handle": "S7zy",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phpipju/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "I can't seem to play some titles on EspressU. For BOTW it asks me for a system update. I got the update and dlc folders on my phone but I can't pick anything in the file browser inside EspressU. Getting an error everytime "
            },
            {
              "href": "https://i.imgur.com/U9EdlFS.png",
              "t": "link",
              "v": "https://i.imgur.com/U9EdlFS.png"
            },
            {
              "t": "text",
              "v": " . The Files are in dumped folder format"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phpu548",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phpu548/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "thats strange, report it on discord"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_phq13ku",
      "author": "allhaildre",
      "handle": "allhaildre",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phq13ku/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Check the discord help forum, I had the same issue and they helped me resolve it"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_phsumt6",
      "author": "Key-Librarian-8050",
      "handle": "Key-Librarian-8050",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phsumt6/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Does it need ram"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phuqdau",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phuqdau/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "yes?"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_phu5ovc",
      "author": "HunglowJohnson",
      "handle": "HunglowJohnson",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phu5ovc/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "How does this compare to melocafe in performance and the compatibility list?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phuqjgx",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phuqjgx/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "for me the performance is similar, sometimes better in some games. Yet i didn’t found a single game which doesn’t start"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rfrbk5b4l1e",
      "author": "HunglowJohnson",
      "handle": "HunglowJohnson",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/19rfrbk5b4l1e/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Thanks!\nWhat file type should games be?"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_phuod8l",
      "author": "Original_Self_1987",
      "handle": "Original_Self_1987",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phuod8l/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Would it run on a iPhone 13?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phuqk8z",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phuqk8z/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "depends on the game but yes"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_phynl87",
      "author": "RUserII",
      "handle": "RUserII",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phynl87/",
      "blocks": [
        {
          "t": "quote",
          "text": [
            {
              "t": "text",
              "v": "Emulator: EspressU v1.0"
            }
          ]
        },
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Is EspressU on the Apple App Store? If not, will it be coming to Apple App Store?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phztano",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phztano/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "you can only sideload it now, i am planning to release a version without JIT on test flight and after that on the app store 👍 i am planning to do that in December"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_pi0a2o8",
      "author": "Bulky_Top3291",
      "handle": "Bulky_Top3291",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pi0a2o8/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "online?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rg4wfdq12tf",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/19rg4wfdq12tf/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "pretendo network"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_pi0cvbp",
      "author": "FOX2132",
      "handle": "FOX2132",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/pi0cvbp/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Do you used getmoreram?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_19rg4w0vrzvr7",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/19rg4w0vrzvr7/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "i used sideinstaller"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_19rip33k3yrgk",
      "author": "Kuro_Neko6833",
      "handle": "Kuro_Neko6833",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/19rip33k3yrgk/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Is get more ram working ? It's giving error"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 2
    },
    {
      "id": "t1_19rixnaxczkhv",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/19rixnaxczkhv/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "dont use getmoreram, its broken. just use sideinstaller"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 3
    },
    {
      "id": "t1_phovmqo",
      "author": "RenatohRibeh",
      "handle": "RenatohRibeh",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phovmqo/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "There's already a port of Mario Kart 8 for iOS—why not use it?"
            }
          ]
        }
      ],
      "comment": true
    },
    {
      "id": "t1_phox5k6",
      "author": "Mundane-Tangerine234",
      "handle": "Mundane-Tangerine234",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phox5k6/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "Ele tá apenas testando o emulador cara"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    },
    {
      "id": "t1_phpdyeu",
      "author": "Obvious_Opening650",
      "handle": "Obvious_Opening650",
      "url": "https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/comment/phpdyeu/",
      "blocks": [
        {
          "t": "paragraph",
          "text": [
            {
              "t": "text",
              "v": "you can play any wil u game with it, this was just a test"
            }
          ]
        }
      ],
      "comment": true,
      "depth": 1
    }
  ],
  "hasan": [
    {
      "id": "2116457666403029040",
      "author": "Hasan Toor",
      "handle": "hasantoxr",
      "url": "https://x.com/hasantoxr/status/2116457666403029040",
      "text": [
        {
          "t": "text",
          "v": "Blender just got a free AI that builds rigged 3D characters from 1 prompt.\n\nIt's called StableGen and it's open source.\n\nDescribe a character, pick a preview image and it does the rest in one run:\n\n→ TRELLIS.2 builds the mesh\n→ SkinTokens adds the skeleton and skin weights\n→ Images generated around the model get projected onto it as the texture\n\nIt also textures models you already have. Place cameras, write a texture prompt, click Generate.\n\nFor game devs:\n\n→ PBR maps baked out\n→ Mixamo animations retargeted onto the rig\n→ Export as glTF for Godot or FBX for Unreal and Unity\n\nIt runs on ComfyUI on your own machine.\n\nAt least 8 GB of VRAM for SDXL texturing. Windows, Linux or Apple Silicon Mac.\n\nLink in the reply 👇"
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116457640599646208/img/3s3iRgD_iRPsmUds.jpg"
        }
      ]
    },
    {
      "id": "2116457678436479035",
      "author": "Hasan Toor",
      "handle": "hasantoxr",
      "url": "https://x.com/hasantoxr/status/2116457678436479035",
      "text": [
        {
          "t": "text",
          "v": "GitHub repo:"
        }
      ],
      "card": {
        "url": "https://t.co/3lE5s2y1jA",
        "title": "GitHub - sakalond/StableGen: Transform your 3D texturing workflow with the power of generative AI,..."
      }
    }
  ],
  "chris": [
    {
      "id": "2116323148706771302",
      "author": "Chris Tate",
      "handle": "ctatedev",
      "url": "https://x.com/ctatedev/status/2116323148706771302",
      "text": [
        {
          "t": "text",
          "v": "Introducing agent-desktop\n\nagent-browser, for your whole computer\n\n→ Computer Use for any coding agent\n→ macOS, Windows and Linux\n→ Runs in bg while you keep working\n→ Agents use your computer in parallel, each with its own cursor"
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116323117836500992/img/lyS2sGQBssVmVsx8.jpg"
        }
      ]
    },
    {
      "id": "2116323151697121498",
      "author": "Chris Tate",
      "handle": "ctatedev",
      "url": "https://x.com/ctatedev/status/2116323151697121498",
      "text": [
        {
          "t": "text",
          "v": "Star it, fork it, tell your agents about it\n\nBuilt by "
        },
        {
          "handle": "mdlahfir",
          "t": "mention",
          "v": "@mdlahfir"
        },
        {
          "t": "text",
          "v": ", who just joined the Vercel Labs team!"
        }
      ],
      "card": {
        "url": "https://t.co/Y7SAuRKLv0",
        "title": "GitHub - vercel-labs/agent-desktop: Agent Desktop gives any agent reliable computer use on the..."
      }
    }
  ],
  "tatsu": [
    {
      "id": "2116101460203286831",
      "author": "Tatsu Matsushima",
      "handle": "tatsunari_m",
      "url": "https://x.com/tatsunari_m/status/2116101460203286831",
      "text": [
        {
          "t": "text",
          "v": "We have developed a new Japanese speech recognition model, Haas-ja-v1.0, and released it as open-source software! It achieves both high accuracy and inference efficiency, attaining the top accuracy among evaluated open-weight models. Demos and more are also available, so please feel free to use it!"
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/media/HV3nBvQaEAAUJDV?format=jpg&name=large"
        },
        {
          "url": "https://pbs.twimg.com/media/HV3nBvMbEAAli2I?format=jpg&name=large"
        },
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116101417001947137/img/wXznPnnWBwo_-2a2.jpg"
        }
      ]
    },
    {
      "id": "2116101463852425481",
      "author": "Tatsu Matsushima",
      "handle": "tatsunari_m",
      "url": "https://x.com/tatsunari_m/status/2116101463852425481",
      "text": [
        {
          "t": "text",
          "v": "Various links are here\nModel: "
        },
        {
          "href": "https://t.co/Mb9QK9PrUS",
          "t": "link",
          "v": "https://\nhuggingface.co/third-intellig\nence/Haas-ja-v1.0\n…"
        },
        {
          "t": "text",
          "v": "\nInference code: "
        },
        {
          "href": "https://t.co/1ClOesnxzW",
          "t": "link",
          "v": "https://\ngithub.com/third-intellig\nence/Haas-ASR\n…"
        },
        {
          "t": "text",
          "v": "\nDemo: "
        },
        {
          "href": "https://t.co/xmGSKMqn34",
          "t": "link",
          "v": "…\nhttps://thi\nrd-intelligence-haas-ja-v1-0.hf.space/longform"
        },
        {
          "t": "text",
          "v": "\nEvaluation library: "
        },
        {
          "href": "https://t.co/rmekQ3sX0H",
          "t": "link",
          "v": "https://\ngithub.com/third-intellig\nence/jacer\n…"
        },
        {
          "t": "text",
          "v": "\nBenchmark data (metadata): "
        },
        {
          "href": "https://t.co/uQT0Tl5DXz",
          "t": "link",
          "v": "https://\nhuggingface.co/datasets/third\n-intelligence/asr-ja-bench\n…"
        },
        {
          "t": "text",
          "v": "\nTech Blog: "
        },
        {
          "href": "https://t.co/q56Pnsp0yq",
          "t": "link",
          "v": "https://\nthird-intelligence.com/ja/posts/haas-\nja-v1-release\n…"
        }
      ],
      "card": {
        "url": "https://t.co/Mb9QK9PrUS",
        "title": "third-intelligence/Haas-ja-v1.0 · Hugging Face"
      }
    },
    {
      "id": "2116101468143190182",
      "author": "Tatsu Matsushima",
      "handle": "tatsunari_m",
      "url": "https://x.com/tatsunari_m/status/2116101468143190182",
      "text": [
        {
          "t": "text",
          "v": "Please also check our company posts."
        }
      ]
    }
  ],
  "joe": [
    {
      "id": "2116347756138856734",
      "author": "Joe Blau",
      "handle": "joeblau",
      "url": "https://x.com/joeblau/status/2116347756138856734",
      "text": [
        {
          "t": "text",
          "v": "I recreated subvocal in 9 minutes with one prompt for AirPods Pro 3.\n\nSource: "
        },
        {
          "href": "https://t.co/p5qYCOdjNl",
          "t": "link",
          "v": "https://\ngithub.com/joeblau/subvox"
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116347012220403712/img/vbMYb0vf16KTYT0i.jpg"
        }
      ]
    },
    {
      "id": "2116683487931727952",
      "author": "Joe Blau",
      "handle": "joeblau",
      "url": "https://x.com/joeblau/status/2116683487931727952",
      "text": [
        {
          "t": "text",
          "v": "Here's the prompt:"
        }
      ],
      "card": {
        "url": "https://t.co/bY8O76GFNG",
        "title": "subvox prompt"
      }
    }
  ],
  "niklas": [
    {
      "id": "2116538181860659354",
      "author": "Niklas",
      "handle": "niklaslenz_ai",
      "url": "https://x.com/niklaslenz_ai/status/2116538181860659354",
      "text": [
        {
          "t": "text",
          "v": "This is so cool! \n\nIdol turns one image into a 3D model in 14.5 s on my RTX 5090. A 16 GB RTX 5060 Ti does it in 57.4 s.\n\nRTX 5090 (32 GB):\nPer image, 262,144 Gaussians: 14.5 s\nPer image, 1,048,576 Gaussians: 15.1 s\nFirst image, compile included: 22.1 s\nPeak VRAM: 7.5 GiB\n\nRTX 5060 Ti (16 GB):\nPer image, 262,144 Gaussians: 57.4 s\nPer image, 1,048,576 Gaussians: 59.8 s\nFirst image, compile included: 73.3 s\nPeak VRAM: 7.0 GiB\n\nOutput: a 3D Gaussian splat\nSteps: 50\nSeed: 42\nFast path: the author's default (torch.compile, batched guidance, cuDNN attention, TF32)\n\nPrecision: mostly FP16 and bf16, some FP32\nSoftware: PyTorch 2.14.1 with CUDA 13.0, idol-sdk 4702a7f\nTiming: image in to splat out, model already loaded\n\nMethod: median of 21 of the author's example images per card, first image counted separately. 1,048,576 Gaussians: median of 8.\n\nThe model invents the back of every object, because the input image never shows it. Same seed on both cards, but the 3D models differ.\n\nEvery number and command: "
        },
        {
          "href": "https://t.co/1VuD5hbsXs",
          "t": "link",
          "v": "https://\nniklaslenz.com/3d/idol-sdk-50\n60ti-5090/\n…"
        },
        {
          "t": "text",
          "v": "\n\nIdol by "
        },
        {
          "handle": "speridlabs",
          "t": "mention",
          "v": "@speridlabs"
        },
        {
          "t": "text",
          "v": ", Apache-2.0. Input images are the author's examples."
        }
      ],
      "media": [
        {
          "url": "https://pbs.twimg.com/amplify_video_thumb/2116460655687475200/img/_ivG_JwdPl_fPlTy.jpg"
        }
      ]
    }
  ]
};
