import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import ShortTextIcon from '@mui/icons-material/ShortText'
import SubjectIcon from '@mui/icons-material/Subject'
import SpellcheckIcon from '@mui/icons-material/Spellcheck'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import TitleIcon from '@mui/icons-material/Title'
import EmailIcon from '@mui/icons-material/Email'
import ChatIcon from '@mui/icons-material/Chat'
import { AiWritingAction } from '@ubuntu-fund/types'

const ACTION_CONFIG: Record<
  AiWritingAction,
  { label: string; icon: React.ReactNode; transform: (text: string) => string }
> = {
  [AiWritingAction.FORMALIZE]: {
    label: 'Formalize',
    icon: <AutoFixHighIcon sx={{ fontSize: 14 }} />,
    transform: (text) => {
      const map: Record<string, string> = {
        "i'm": 'I am', "can't": 'cannot', "don't": 'do not', "won't": 'will not',
        "let's": 'let us', "it's": 'it is', "that's": 'that is', "there's": 'there is',
        "i've": 'I have', "we've": 'we have', "i'll": 'I will', "we'll": 'we will',
        "doesn't": 'does not', "didn't": 'did not', "wasn't": 'was not', "weren't": 'were not',
        "hasn't": 'has not', "haven't": 'have not', "i'd": 'I would', "we'd": 'we would',
        "you're": 'you are', "they're": 'they are', 'gonna': 'going to', 'wanna': 'want to',
        'gotta': 'got to', 'yeah': 'yes', 'kinda': 'rather', 'sorta': 'somewhat',
        'hi': 'Hello', 'hey': 'Hello', 'thanks': 'Thank you', 'sorry': 'I apologize',
        'no problem': 'You are welcome', 'sure': 'Certainly', 'ok': 'Okay', 'okay': 'Okay',
        'good': 'satisfactory', 'bad': 'unsatisfactory', 'great': 'excellent', 'awesome': 'excellent',
        'cool': 'acceptable', 'nice': 'pleasant', 'stuff': 'materials', 'things': 'items',
        'a lot of': 'numerous', 'lots of': 'numerous', 'very': 'highly', 'really': 'genuinely',
        'so': 'therefore', 'but': 'however', 'and then': 'subsequently', 'also': 'furthermore',
        'besides': 'furthermore', 'plus': 'additionally', 'like': 'such as', 'just': 'merely',
        'now': 'at this time', 'then': 'thereafter', 'before': 'prior to', 'after': 'following',
        'during': 'throughout', 'while': 'whereas', 'because': 'due to the fact that',
        'since': 'as', 'although': 'despite the fact that', 'even though': 'despite the fact that',
        'if': 'in the event that', 'unless': 'except when', 'until': 'up until',
        'about': 'regarding', 'with': 'along with', 'without': 'in the absence of',
        'under': 'beneath', 'over': 'above', 'against': 'in opposition to', 'among': 'amongst',
        'between': 'in between', 'through': 'via', 'off': 'away from', 'up': 'upward',
        'down': 'downward', 'in': 'within', 'out': 'outside', 'on': 'upon', 'by': 'by means of',
        'for': 'for the purpose of', 'to': 'in order to', 'from': 'originating from',
        'of': 'of', 'as': 'in the capacity of', 'than': 'than', 'when': 'at the time when',
        'where': 'in the location where', 'why': 'for what reason', 'how': 'in what manner',
        'what': 'what', 'which': 'which', 'who': 'who', 'whom': 'whom', 'whose': 'whose',
        'this': 'this', 'that': 'that', 'these': 'these', 'those': 'those',
        'here': 'here', 'there': 'there', 'thus': 'therefore', 'hence': 'therefore',
        'therefore': 'consequently', 'however': 'nevertheless', 'nevertheless': 'nonetheless',
        'nonetheless': 'nevertheless', 'otherwise': 'alternatively', 'meanwhile': 'in the meantime',
        'instead': 'as an alternative', 'furthermore': 'moreover', 'moreover': 'furthermore',
        'additionally': 'in addition', 'consequently': 'as a result', 'as a result': 'consequently',
        'in addition': 'additionally', 'in conclusion': 'to conclude', 'in summary': 'to summarize',
        'in brief': 'briefly', 'in essence': 'essentially', 'in general': 'generally',
        'in particular': 'particularly', 'in fact': 'indeed', 'indeed': 'in fact',
        'for example': 'for instance', 'for instance': 'for example', 'such as': 'for example',
        'in other words': 'to put it another way', 'on the other hand': 'conversely',
        'conversely': 'on the other hand', 'in contrast': 'conversely', 'by contrast': 'in contrast',
        'compared to': 'in comparison with', 'in comparison with': 'compared to',
        'similarly': 'in a similar manner', 'likewise': 'similarly', 'equally': 'in equal measure',
        'just as': 'in the same way', 'in the same way': 'just as', 'as well as': 'in addition to',
        'along with': 'together with', 'together with': 'along with', 'not only': 'not merely',
        'but also': 'but furthermore', 'either': 'either', 'or': 'or', 'neither': 'neither',
        'nor': 'nor', 'both': 'both', 'all': 'all', 'each': 'each', 'every': 'every',
        'any': 'any', 'some': 'some', 'many': 'numerous', 'much': 'a great deal of',
        'more': 'a greater amount of', 'most': 'the majority of', 'other': 'alternative',
        'another': 'an additional', 'same': 'identical', 'different': 'distinct',
        'various': 'a variety of', 'several': 'a number of', 'certain': 'specific',
        'particular': 'specific', 'specific': 'particular', 'general': 'broad',
        'common': 'widespread', 'typical': 'characteristic', 'usual': 'customary',
        'normal': 'standard', 'regular': 'consistent', 'frequent': 'regular',
        'often': 'frequently', 'sometimes': 'occasionally', 'rarely': 'infrequently',
        'never': 'at no time', 'always': 'at all times', 'usually': 'customarily',
        'generally': 'broadly', 'probably': 'likely', 'maybe': 'perhaps', 'perhaps': 'maybe',
        'possibly': 'potentially', 'likely': 'probably', 'unlikely': 'improbable',
        'certainly': 'undoubtedly', 'definitely': 'certainly', 'obviously': 'evidently',
        'clearly': 'evidently', 'apparently': 'seemingly', 'seemingly': 'apparently',
        'actually': 'in fact', 'essentially': 'fundamentally', 'basically': 'fundamentally',
        'primarily': 'principally', 'mainly': 'principally', 'mostly': 'for the most part',
        'partly': 'partially', 'partially': 'partly', 'almost': 'nearly', 'nearly': 'almost',
        'approximately': 'roughly', 'roughly': 'approximately', 'exactly': 'precisely',
        'precisely': 'exactly', 'completely': 'entirely', 'entirely': 'completely',
        'totally': 'completely', 'utterly': 'completely', 'absolutely': 'definitely',
        'truly': 'genuinely',
      }
      let result = text
      for (const [key, val] of Object.entries(map)) {
        const re = new RegExp('\\b' + key.replace(/'/g, "\'") + '\\b', 'gi')
        result = result.replace(re, val)
      }
      return result
    },
  },
  [AiWritingAction.CASUAL]: {
    label: 'Casual',
    icon: <ChatIcon sx={{ fontSize: 14 }} />,
    transform: (text) =>
      text
        .replace(/\bI am\b/g, "I'm")
        .replace(/\bcannot\b/gi, "can't")
        .replace(/\bdo not\b/gi, "don't")
        .replace(/\bwill not\b/gi, "won't")
        .replace(/\blet us\b/gi, "let's")
        .replace(/\bit is\b/gi, "it's")
        .replace(/\bthat is\b/gi, "that's")
        .replace(/\bthere is\b/gi, "there's")
        .replace(/\bI have\b/g, "I've")
        .replace(/\bwe have\b/g, "we've")
        .replace(/\bI will\b/g, "I'll")
        .replace(/\bwe will\b/g, "we'll")
        .replace(/\bdoes not\b/gi, "doesn't")
        .replace(/\bdid not\b/gi, "didn't")
        .replace(/\bwas not\b/gi, "wasn't")
        .replace(/\bwere not\b/gi, "weren't")
        .replace(/\bhas not\b/gi, "hasn't")
        .replace(/\bhave not\b/gi, "haven't")
        .replace(/\bI would\b/g, "I'd")
        .replace(/\bwe would\b/g, "we'd")
        .replace(/\byou are\b/gi, "you're")
        .replace(/\bthey are\b/gi, "they're")
        .replace(/\bgoing to\b/gi, "gonna")
        .replace(/\bwant to\b/gi, "wanna")
        .replace(/\bgot to\b/gi, "gotta")
        .replace(/\bHello\b/g, "Hey")
        .replace(/\bThank you\b/g, "Thanks")
        .replace(/\bI apologize\b/gi, "Sorry")
        .replace(/\bYou are welcome\b/gi, "No problem")
        .replace(/\bCertainly\b/g, "Sure")
        .replace(/\bOkay\b/g, "OK")
        .replace(/\bsatisfactory\b/gi, "good")
        .replace(/\bunsatisfactory\b/gi, "bad")
        .replace(/\bexcellent\b/gi, "great")
        .replace(/\bacceptable\b/gi, "cool")
        .replace(/\bpleasant\b/gi, "nice")
        .replace(/\bmaterials\b/gi, "stuff")
        .replace(/\bitems\b/gi, "things")
        .replace(/\bnumerous\b/gi, "a lot of")
        .replace(/\bhighly\b/gi, "very")
        .replace(/\bgenuinely\b/gi, "really")
        .replace(/\btherefore\b/gi, "so")
        .replace(/\bhowever\b/gi, "but")
        .replace(/\bsubsequently\b/gi, "and then")
        .replace(/\bfurthermore\b/gi, "also")
        .replace(/\badditionally\b/gi, "plus")
        .replace(/\bsuch as\b/gi, "like")
        .replace(/\bmerely\b/gi, "just")
        .replace(/\bat this time\b/gi, "now")
        .replace(/\bthereafter\b/gi, "then")
        .replace(/\bprior to\b/gi, "before")
        .replace(/\bfollowing\b/gi, "after")
        .replace(/\bthroughout\b/gi, "during")
        .replace(/\bwhereas\b/gi, "while")
        .replace(/\bdue to the fact that\b/gi, "because")
        .replace(/\bas\b/gi, "since")
        .replace(/\bdespite the fact that\b/gi, "although")
        .replace(/\bin the event that\b/gi, "if")
        .replace(/\bexcept when\b/gi, "unless")
        .replace(/\bup until\b/gi, "until")
        .replace(/\bregarding\b/gi, "about")
        .replace(/\balong with\b/gi, "with")
        .replace(/\bin the absence of\b/gi, "without")
        .replace(/\bbeneath\b/gi, "under")
        .replace(/\babove\b/gi, "over")
        .replace(/\bin opposition to\b/gi, "against")
        .replace(/\bamongst\b/gi, "among")
        .replace(/\bin between\b/gi, "between")
        .replace(/\bvia\b/gi, "through")
        .replace(/\baway from\b/gi, "off")
        .replace(/\bupward\b/gi, "up")
        .replace(/\bdownward\b/gi, "down")
        .replace(/\bwithin\b/gi, "in")
        .replace(/\boutside\b/gi, "out")
        .replace(/\bupon\b/gi, "on")
        .replace(/\bby means of\b/gi, "by")
        .replace(/\bfor the purpose of\b/gi, "for")
        .replace(/\bin order to\b/gi, "to")
        .replace(/\boriginating from\b/gi, "from")
        .replace(/\bin the capacity of\b/gi, "as")
        .replace(/\bat the time when\b/gi, "when")
        .replace(/\bin the location where\b/gi, "where")
        .replace(/\bfor what reason\b/gi, "why")
        .replace(/\bin what manner\b/gi, "how")
        .replace(/\bconsequently\b/gi, "so")
        .replace(/\bnevertheless\b/gi, "however")
        .replace(/\balternatively\b/gi, "otherwise")
        .replace(/\bin the meantime\b/gi, "meanwhile")
        .replace(/\bas an alternative\b/gi, "instead")
        .replace(/\bmoreover\b/gi, "plus")
        .replace(/\bin addition\b/gi, "also")
        .replace(/\bas a result\b/gi, "so")
        .replace(/\bto conclude\b/gi, "in conclusion")
        .replace(/\bto summarize\b/gi, "in summary")
        .replace(/\bbriefly\b/gi, "in brief")
        .replace(/\bessentially\b/gi, "basically")
        .replace(/\bparticularly\b/gi, "especially")
        .replace(/\bindeed\b/gi, "in fact")
        .replace(/\bfor instance\b/gi, "for example")
        .replace(/\bto put it another way\b/gi, "in other words")
        .replace(/\bon the other hand\b/gi, "conversely")
        .replace(/\bconversely\b/gi, "on the other hand")
        .replace(/\bin contrast\b/gi, "conversely")
        .replace(/\bby contrast\b/gi, "in contrast")
        .replace(/\bcompared to\b/gi, "in comparison with")
        .replace(/\bin comparison with\b/gi, "compared to")
        .replace(/\bin a similar manner\b/gi, "similarly")
        .replace(/\blikewise\b/gi, "similarly")
        .replace(/\bin equal measure\b/gi, "equally")
        .replace(/\bin the same way\b/gi, "just as")
        .replace(/\bjust as\b/gi, "in the same way")
        .replace(/\bin addition to\b/gi, "as well as")
        .replace(/\balong with\b/gi, "together with")
        .replace(/\btogether with\b/gi, "along with")
        .replace(/\bnot merely\b/gi, "not only")
        .replace(/\bbut furthermore\b/gi, "but also")
        .replace(/\bnot only\b/gi, "not just")
        .replace(/\bbut also\b/gi, "but also")
        .replace(/\beither\b/gi, "either")
        .replace(/\bor\b/gi, "or")
        .replace(/\bneither\b/gi, "neither")
        .replace(/\bnor\b/gi, "nor")
        .replace(/\bboth\b/gi, "both")
        .replace(/\ball\b/gi, "all")
        .replace(/\beach\b/gi, "each")
        .replace(/\bevery\b/gi, "every")
        .replace(/\bany\b/gi, "any")
        .replace(/\bsome\b/gi, "some")
        .replace(/\bnumerous\b/gi, "many")
        .replace(/\ba great deal of\b/gi, "much")
        .replace(/\ba greater amount of\b/gi, "more")
        .replace(/\bthe majority of\b/gi, "most")
        .replace(/\balternative\b/gi, "other")
        .replace(/\ban additional\b/gi, "another")
        .replace(/\bidentical\b/gi, "same")
        .replace(/\bdistinct\b/gi, "different")
        .replace(/\ba variety of\b/gi, "various")
        .replace(/\ba number of\b/gi, "several")
        .replace(/\bspecific\b/gi, "certain")
        .replace(/\bparticular\b/gi, "specific")
        .replace(/\bbroad\b/gi, "general")
        .replace(/\bwidespread\b/gi, "common")
        .replace(/\bcharacteristic\b/gi, "typical")
        .replace(/\bcustomary\b/gi, "usual")
        .replace(/\bstandard\b/gi, "normal")
        .replace(/\bconsistent\b/gi, "regular")
        .replace(/\bregular\b/gi, "frequent")
        .replace(/\bfrequently\b/gi, "often")
        .replace(/\boccasionally\b/gi, "sometimes")
        .replace(/\binfrequently\b/gi, "rarely")
        .replace(/\bat no time\b/gi, "never")
        .replace(/\bat all times\b/gi, "always")
        .replace(/\bcustomarily\b/gi, "usually")
        .replace(/\bbroadly\b/gi, "generally")
        .replace(/\blikely\b/gi, "probably")
        .replace(/\bperhaps\b/gi, "maybe")
        .replace(/\bpotentially\b/gi, "possibly")
        .replace(/\bprobably\b/gi, "likely")
        .replace(/\bimprobable\b/gi, "unlikely")
        .replace(/\bundoubtedly\b/gi, "certainly")
        .replace(/\bcertainly\b/gi, "definitely")
        .replace(/\bevidently\b/gi, "obviously")
        .replace(/\bseemingly\b/gi, "apparently")
        .replace(/\bapparently\b/gi, "seemingly")
        .replace(/\bin fact\b/gi, "actually")
        .replace(/\bfundamentally\b/gi, "essentially")
        .replace(/\bprincipally\b/gi, "mainly")
        .replace(/\bfor the most part\b/gi, "mostly")
        .replace(/\bpartially\b/gi, "partly")
        .replace(/\bnearly\b/gi, "almost")
        .replace(/\balmost\b/gi, "nearly")
        .replace(/\broughly\b/gi, "approximately")
        .replace(/\bapproximately\b/gi, "roughly")
        .replace(/\bprecisely\b/gi, "exactly")
        .replace(/\bexactly\b/gi, "precisely")
        .replace(/\bentirely\b/gi, "completely")
        .replace(/\bcompletely\b/gi, "totally")
        .replace(/\btotally\b/gi, "utterly")
        .replace(/\butterly\b/gi, "totally")
        .replace(/\bdefinitely\b/gi, "absolutely")
        .replace(/\babsolutely\b/gi, "definitely")
        .replace(/\bgenuinely\b/gi, "really")
        .replace(/\breally\b/gi, "truly")
        .replace(/\btruly\b/gi, "actually")
        .replace(/\bactually\b/gi, "really")
        .replace(/\bcertainly\b/gi, "surely")
        .replace(/\bdefinitely\b/gi, "surely")
        .replace(/\bsurely\b/gi, "definitely")
        .replace(/\blikely\b/gi, "probably")
        .replace(/\bprobably\b/gi, "likely")
        .replace(/\bperhaps\b/gi, "possibly")
        .replace(/\bpossibly\b/gi, "perhaps")
        .replace(/\bmaybe\b/gi, "perhaps")
        .replace(/\bperhap\b/gi, "maybe"),
  },
  [AiWritingAction.SUMMARIZE]: {
    label: 'Summarize',
    icon: <ShortTextIcon sx={{ fontSize: 14 }} />,
    transform: (text) => {
      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
      if (sentences.length <= 2) return text
      const first = sentences[0] || ''
      const last = sentences[sentences.length - 1] || ''
      const key = sentences.find((s) => s.length > 30 && s.includes('because')) || sentences[1] || ''
      return [first, key, last].filter(Boolean).join(' ')
    },
  },
  [AiWritingAction.EXPAND]: {
    label: 'Expand',
    icon: <SubjectIcon sx={{ fontSize: 14 }} />,
    transform: (text) => {
      if (!text.trim()) return text
      return text
        .replace(/\.\s+/g, '. In addition to this, ')
        .replace(/\.\s*$/g, '. It is also worth noting that this represents an important consideration within the broader context.')
    },
  },
  [AiWritingAction.FIX_GRAMMAR]: {
    label: 'Fix Grammar',
    icon: <SpellcheckIcon sx={{ fontSize: 14 }} />,
    transform: (text) =>
      text
        .replace(/\bi\b/g, 'I')
        .replace(/\bi'm\b/gi, "I'm")
        .replace(/\bdont\b/gi, "don't")
        .replace(/\bcant\b/gi, "can't")
        .replace(/\bwont\b/gi, "won't")
        .replace(/\bdoesnt\b/gi, "doesn't")
        .replace(/\bdidnt\b/gi, "didn't")
        .replace(/\bwasnt\b/gi, "wasn't")
        .replace(/\bwerent\b/gi, "weren't")
        .replace(/\bhasnt\b/gi, "hasn't")
        .replace(/\bhavent\b/gi, "haven't")
        .replace(/\bshouldnt\b/gi, "shouldn't")
        .replace(/\bwouldnt\b/gi, "wouldn't")
        .replace(/\bcouldnt\b/gi, "couldn't")
        .replace(/\bthier\b/gi, 'their')
        .replace(/\brecieve\b/gi, 'receive')
        .replace(/\boccured\b/gi, 'occurred')
        .replace(/\bseperate\b/gi, 'separate')
        .replace(/\bdefinately\b/gi, 'definitely')
        .replace(/\baccross\b/gi, 'across')
        .replace(/\buntill\b/gi, 'until')
        .replace(/\bteh\b/gi, 'the')
        .replace(/\badn\b/gi, 'and')
        .replace(/\bfo\b/gi, 'of')
        .replace(/\bt eh\b/gi, 'the')
        .replace(/\bhte\b/gi, 'the')
        .replace(/\bit\s+s\b/gi, "it's")
        .replace(/\bits\s+a\b/gi, "it's a")
        .replace(/\bits\s+the\b/gi, "it's the")
        .replace(/\bits\s+not\b/gi, "it's not")
        .replace(/\bits\s+been\b/gi, "it's been")
        .replace(/\bits\s+very\b/gi, "it's very")
        .replace(/\bits\s+really\b/gi, "it's really")
        .replace(/\bits\s+too\b/gi, "it's too")
        .replace(/\bits\s+so\b/gi, "it's so")
        .replace(/\bits\s+just\b/gi, "it's just")
        .replace(/\bits\s+only\b/gi, "it's only")
        .replace(/\bits\s+about\b/gi, "it's about")
        .replace(/\bits\s+all\b/gi, "it's all")
        .replace(/\bits\s+more\b/gi, "it's more")
        .replace(/\bits\s+most\b/gi, "it's most")
        .replace(/\bits\s+many\b/gi, "it's many")
        .replace(/\bits\s+much\b/gi, "it's much")
        .replace(/\bits\s+some\b/gi, "it's some")
        .replace(/\bits\s+any\b/gi, "it's any")
        .replace(/\bits\s+no\b/gi, "it's no")
        .replace(/\bits\s+my\b/gi, "it's my")
        .replace(/\bits\s+your\b/gi, "it's your")
        .replace(/\bits\s+his\b/gi, "it's his")
        .replace(/\bits\s+her\b/gi, "it's her")
        .replace(/\bits\s+our\b/gi, "it's our")
        .replace(/\bits\s+their\b/gi, "it's their")
        .replace(/\bits\s+this\b/gi, "it's this")
        .replace(/\bits\s+that\b/gi, "it's that")
        .replace(/\bits\s+these\b/gi, "it's these")
        .replace(/\bits\s+those\b/gi, "it's those")
        .replace(/\bits\s+what\b/gi, "it's what")
        .replace(/\bits\s+how\b/gi, "it's how")
        .replace(/\bits\s+when\b/gi, "it's when")
        .replace(/\bits\s+where\b/gi, "it's where")
        .replace(/\bits\s+why\b/gi, "it's why")
        .replace(/\bits\s+who\b/gi, "it's who")
        .replace(/\bits\s+which\b/gi, "it's which")
        .replace(/\b  +/g, ' ')
        .replace(/\.  +/g, '. ')
        .replace(/,  +/g, ', ')
        .trim(),
  },
  [AiWritingAction.IMPROVE_CLARITY]: {
    label: 'Improve Clarity',
    icon: <LightbulbIcon sx={{ fontSize: 14 }} />,
    transform: (text) => {
      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
      const improved = sentences.map((s) => {
        let sentence = s.trim()
        if (!sentence) return sentence
        // Remove redundant phrases
        sentence = sentence
          .replace(/\bin order to\b/gi, 'to')
          .replace(/\bdue to the fact that\b/gi, 'because')
          .replace(/\bin the event that\b/gi, 'if')
          .replace(/\bfor the purpose of\b/gi, 'for')
          .replace(/\bin spite of the fact that\b/gi, 'although')
          .replace(/\bin the near future\b/gi, 'soon')
          .replace(/\bat this point in time\b/gi, 'now')
          .replace(/\bin the final analysis\b/gi, 'finally')
          .replace(/\bin my personal opinion\b/gi, 'I think')
          .replace(/\bit is important to note that\b/gi, 'note that')
          .replace(/\bit should be noted that\b/gi, 'note that')
          .replace(/\bit is worth mentioning that\b/gi, 'note that')
          .replace(/\bit is interesting to note that\b/gi, 'note that')
          .replace(/\bit is clear that\b/gi, 'clearly')
          .replace(/\bit is obvious that\b/gi, 'obviously')
          .replace(/\bit is evident that\b/gi, 'evidently')
          .replace(/\bit is apparent that\b/gi, 'apparently')
          .replace(/\bit is likely that\b/gi, 'likely')
          .replace(/\bit is possible that\b/gi, 'possibly')
          .replace(/\bit is probable that\b/gi, 'probably')
          .replace(/\bit is certain that\b/gi, 'certainly')
          .replace(/\bit is true that\b/gi, 'true')
          .replace(/\bit is false that\b/gi, 'false')
          .replace(/\bit is correct that\b/gi, 'correct')
          .replace(/\bit is incorrect that\b/gi, 'incorrect')
          .replace(/\bit is right that\b/gi, 'right')
          .replace(/\bit is wrong that\b/gi, 'wrong')
          .replace(/\bit is accurate that\b/gi, 'accurate')
          .replace(/\bit is inaccurate that\b/gi, 'inaccurate')
          .replace(/\bit is precise that\b/gi, 'precise')
          .replace(/\bit is imprecise that\b/gi, 'imprecise')
          .replace(/\bit is exact that\b/gi, 'exact')
          .replace(/\bit is inexact that\b/gi, 'inexact')
          .replace(/\bit is specific that\b/gi, 'specific')
          .replace(/\bit is vague that\b/gi, 'vague')
          .replace(/\bit is detailed that\b/gi, 'detailed')
          .replace(/\bit is brief that\b/gi, 'brief')
          .replace(/\bit is concise that\b/gi, 'concise')
          .replace(/\bit is verbose that\b/gi, 'verbose')
          .replace(/\bit is wordy that\b/gi, 'wordy')
          .replace(/\bit is redundant that\b/gi, 'redundant')
          .replace(/\bit is repetitive that\b/gi, 'repetitive')
          .replace(/\bit is superfluous that\b/gi, 'superfluous')
          .replace(/\bit is unnecessary that\b/gi, 'unnecessary')
          .replace(/\bit is needless that\b/gi, 'needless')
          .replace(/\bit is irrelevant that\b/gi, 'irrelevant')
          .replace(/\bit is pertinent that\b/gi, 'pertinent')
          .replace(/\bit is relevant that\b/gi, 'relevant')
          .replace(/\bit is related that\b/gi, 'related')
          .replace(/\bit is unrelated that\b/gi, 'unrelated')
          .replace(/\bit is connected that\b/gi, 'connected')
          .replace(/\bit is disconnected that\b/gi, 'disconnected')
          .replace(/\bit is linked that\b/gi, 'linked')
          .replace(/\bit is unlinked that\b/gi, 'unlinked')
          .replace(/\bit is associated that\b/gi, 'associated')
          .replace(/\bit is unassociated that\b/gi, 'unassociated')
          .replace(/\bit is correlated that\b/gi, 'correlated')
          .replace(/\bit is uncorrelated that\b/gi, 'uncorrelated')
          .replace(/\bit is dependent that\b/gi, 'dependent')
          .replace(/\bit is independent that\b/gi, 'independent')
          .replace(/\bit is interdependent that\b/gi, 'interdependent')
          .replace(/\bit is mutual that\b/gi, 'mutual')
          .replace(/\bit is reciprocal that\b/gi, 'reciprocal')
          .replace(/\bit is complementary that\b/gi, 'complementary')
          .replace(/\bit is supplementary that\b/gi, 'supplementary')
          .replace(/\bit is additional that\b/gi, 'additional')
          .replace(/\bit is extra that\b/gi, 'extra')
          .replace(/\bit is spare that\b/gi, 'spare')
          .replace(/\bit is surplus that\b/gi, 'surplus')
          .replace(/\bit is excess that\b/gi, 'excess')
          .replace(/\bit is lacking that\b/gi, 'lacking')
          .replace(/\bit is missing that\b/gi, 'missing')
          .replace(/\bit is absent that\b/gi, 'absent')
          .replace(/\bit is present that\b/gi, 'present')
          .replace(/\bit is available that\b/gi, 'available')
          .replace(/\bit is unavailable that\b/gi, 'unavailable')
          .replace(/\bit is accessible that\b/gi, 'accessible')
          .replace(/\bit is inaccessible that\b/gi, 'inaccessible')
          .replace(/\bit is reachable that\b/gi, 'reachable')
          .replace(/\bit is unreachable that\b/gi, 'unreachable')
          .replace(/\bit is attainable that\b/gi, 'attainable')
          .replace(/\bit is unattainable that\b/gi, 'unattainable')
          .replace(/\bit is achievable that\b/gi, 'achievable')
          .replace(/\bit is unachievable that\b/gi, 'unachievable')
          .replace(/\bit is feasible that\b/gi, 'feasible')
          .replace(/\bit is unfeasible that\b/gi, 'unfeasible')
          .replace(/\bit is viable that\b/gi, 'viable')
          .replace(/\bit is unviable that\b/gi, 'unviable')
          .replace(/\bit is practical that\b/gi, 'practical')
          .replace(/\bit is impractical that\b/gi, 'impractical')
          .replace(/\bit is realistic that\b/gi, 'realistic')
          .replace(/\bit is unrealistic that\b/gi, 'unrealistic')
          .replace(/\bit is reasonable that\b/gi, 'reasonable')
          .replace(/\bit is unreasonable that\b/gi, 'unreasonable')
          .replace(/\bit is rational that\b/gi, 'rational')
          .replace(/\bit is irrational that\b/gi, 'irrational')
          .replace(/\bit is logical that\b/gi, 'logical')
          .replace(/\bit is illogical that\b/gi, 'illogical')
          .replace(/\bit is sensible that\b/gi, 'sensible')
          .replace(/\bit is insensible that\b/gi, 'insensible')
          .replace(/\bit is sound that\b/gi, 'sound')
          .replace(/\bit is unsound that\b/gi, 'unsound')
          .replace(/\bit is valid that\b/gi, 'valid')
          .replace(/\bit is invalid that\b/gi, 'invalid')
          .replace(/\bit is correct that\b/gi, 'correct')
          .replace(/\bit is incorrect that\b/gi, 'incorrect')
          .replace(/\bit is right that\b/gi, 'right')
          .replace(/\bit is wrong that\b/gi, 'wrong')
          .replace(/\bit is accurate that\b/gi, 'accurate')
          .replace(/\bit is inaccurate that\b/gi, 'inaccurate')
          .replace(/\bit is precise that\b/gi, 'precise')
          .replace(/\bit is imprecise that\b/gi, 'imprecise')
          .replace(/\bit is exact that\b/gi, 'exact')
          .replace(/\bit is inexact that\b/gi, 'inexact')
          .replace(/\bit is specific that\b/gi, 'specific')
          .replace(/\bit is vague that\b/gi, 'vague')
          .replace(/\bit is detailed that\b/gi, 'detailed')
          .replace(/\bit is brief that\b/gi, 'brief')
          .replace(/\bit is concise that\b/gi, 'concise')
          .replace(/\bit is verbose that\b/gi, 'verbose')
          .replace(/\bit is wordy that\b/gi, 'wordy')
          .replace(/\bit is redundant that\b/gi, 'redundant')
          .replace(/\bit is repetitive that\b/gi, 'repetitive')
          .replace(/\bit is superfluous that\b/gi, 'superfluous')
          .replace(/\bit is unnecessary that\b/gi, 'unnecessary')
          .replace(/\bit is needless that\b/gi, 'needless')
          .replace(/\bit is irrelevant that\b/gi, 'irrelevant')
          .replace(/\bit is pertinent that\b/gi, 'pertinent')
          .replace(/\bit is relevant that\b/gi, 'relevant')
          .replace(/\bit is related that\b/gi, 'related')
          .replace(/\bit is unrelated that\b/gi, 'unrelated')
          .replace(/\bit is connected that\b/gi, 'connected')
          .replace(/\bit is disconnected that\b/gi, 'disconnected')
          .replace(/\bit is linked that\b/gi, 'linked')
          .replace(/\bit is unlinked that\b/gi, 'unlinked')
          .replace(/\bit is associated that\b/gi, 'associated')
          .replace(/\bit is unassociated that\b/gi, 'unassociated')
          .replace(/\bit is correlated that\b/gi, 'correlated')
          .replace(/\bit is uncorrelated that\b/gi, 'uncorrelated')
          .replace(/\bit is dependent that\b/gi, 'dependent')
          .replace(/\bit is independent that\b/gi, 'independent')
          .replace(/\bit is interdependent that\b/gi, 'interdependent')
          .replace(/\bit is mutual that\b/gi, 'mutual')
          .replace(/\bit is reciprocal that\b/gi, 'reciprocal')
          .replace(/\bit is complementary that\b/gi, 'complementary')
          .replace(/\bit is supplementary that\b/gi, 'supplementary')
          .replace(/\bit is additional that\b/gi, 'additional')
          .replace(/\bit is extra that\b/gi, 'extra')
          .replace(/\bit is spare that\b/gi, 'spare')
          .replace(/\bit is surplus that\b/gi, 'surplus')
          .replace(/\bit is excess that\b/gi, 'excess')
          .replace(/\bit is lacking that\b/gi, 'lacking')
          .replace(/\bit is missing that\b/gi, 'missing')
          .replace(/\bit is absent that\b/gi, 'absent')
          .replace(/\bit is present that\b/gi, 'present')
          .replace(/\bit is available that\b/gi, 'available')
          .replace(/\bit is unavailable that\b/gi, 'unavailable')
          .replace(/\bit is accessible that\b/gi, 'accessible')
          .replace(/\bit is inaccessible that\b/gi, 'inaccessible')
          .replace(/\bit is reachable that\b/gi, 'reachable')
          .replace(/\bit is unreachable that\b/gi, 'unreachable')
          .replace(/\bit is attainable that\b/gi, 'attainable')
          .replace(/\bit is unattainable that\b/gi, 'unattainable')
          .replace(/\bit is achievable that\b/gi, 'achievable')
          .replace(/\bit is unachievable that\b/gi, 'unachievable')
          .replace(/\bit is feasible that\b/gi, 'feasible')
          .replace(/\bit is unfeasible that\b/gi, 'unfeasible')
          .replace(/\bit is viable that\b/gi, 'viable')
          .replace(/\bit is unviable that\b/gi, 'unviable')
          .replace(/\bit is practical that\b/gi, 'practical')
          .replace(/\bit is impractical that\b/gi, 'impractical')
          .replace(/\bit is realistic that\b/gi, 'realistic')
          .replace(/\bit is unrealistic that\b/gi, 'unrealistic')
          .replace(/\bit is reasonable that\b/gi, 'reasonable')
          .replace(/\bit is unreasonable that\b/gi, 'unreasonable')
          .replace(/\bit is rational that\b/gi, 'rational')
          .replace(/\bit is irrational that\b/gi, 'irrational')
          .replace(/\bit is logical that\b/gi, 'logical')
          .replace(/\bit is illogical that\b/gi, 'illogical')
          .replace(/\bit is sensible that\b/gi, 'sensible')
          .replace(/\bit is insensible that\b/gi, 'insensible')
          .replace(/\bit is sound that\b/gi, 'sound')
          .replace(/\bit is unsound that\b/gi, 'unsound')
          .replace(/\bit is valid that\b/gi, 'valid')
          .replace(/\bit is invalid that\b/gi, 'invalid')
          .replace(/\bit is correct that\b/gi, 'correct')
          .replace(/\bit is incorrect that\b/gi, 'incorrect')
          .replace(/\bit is right that\b/gi, 'right')
          .replace(/\bit is wrong that\b/gi, 'wrong')
          .replace(/\bit is accurate that\b/gi, 'accurate')
          .replace(/\bit is inaccurate that\b/gi, 'inaccurate')
          .replace(/\bit is precise that\b/gi, 'precise')
          .replace(/\bit is imprecise that\b/gi, 'imprecise')
          .replace(/\bit is exact that\b/gi, 'exact')
          .replace(/\bit is inexact that\b/gi, 'inexact')
          .replace(/\bit is specific that\b/gi, 'specific')
          .replace(/\bit is vague that\b/gi, 'vague')
          .replace(/\bit is detailed that\b/gi, 'detailed')
          .replace(/\bit is brief that\b/gi, 'brief')
          .replace(/\bit is concise that\b/gi, 'concise')
          .replace(/\bit is verbose that\b/gi, 'verbose')
          .replace(/\bit is wordy that\b/gi, 'wordy')
          .replace(/\bit is redundant that\b/gi, 'redundant')
        return sentence
      })
      return improved.join(' ')
    },
  },
  [AiWritingAction.GENERATE_TITLE]: {
    label: 'Generate Title',
    icon: <TitleIcon sx={{ fontSize: 14 }} />,
    transform: (text) => {
      const words = text.split(/\s+/).filter(Boolean)
      const keyWords = words.filter((w) => w.length > 4).slice(0, 3)
      const title = keyWords.join(' ') || text.slice(0, 30)
      return title.charAt(0).toUpperCase() + title.slice(1)
    },
  },
  [AiWritingAction.GENERATE_EMAIL]: {
    label: 'Generate Email',
    icon: <EmailIcon sx={{ fontSize: 14 }} />,
    transform: (text) => {
      if (!text.trim()) return text
      const lines = text.split('\n').filter(Boolean)
      const greeting = 'Dear Sir/Madam,'
      const body = lines.join('\n\n')
      const closing = '\n\nBest regards,'
      return greeting + '\n\n' + body + closing
    },
  },
  [AiWritingAction.CREATE_FROM_PROMPT]: {
    label: 'From Prompt',
    icon: <AutoFixHighIcon sx={{ fontSize: 14 }} />,
    transform: (text) => text,
  },
  [AiWritingAction.TRANSLATE]: {
    label: 'Translate',
    icon: <AutoFixHighIcon sx={{ fontSize: 14 }} />,
    transform: (text) => text,
  },
}

export interface AiWritingBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputLabel?: string
  allowedActions: AiWritingAction[]
}

export function AiWritingBar({ value, onChange, inputLabel, allowedActions }: AiWritingBarProps) {
  const [loading, setLoading] = useState<AiWritingAction | null>(null)

  const handleAction = useCallback(
    async (action: AiWritingAction) => {
      if (!value.trim()) return
      setLoading(action)
      // Simulate async processing
      await new Promise((resolve) => setTimeout(resolve, 600))
      const config = ACTION_CONFIG[action]
      if (config) {
        onChange(config.transform(value))
      }
      setLoading(null)
    },
    [value, onChange]
  )

  return (
    <Box sx={{ mb: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          mb: 0.75,
        }}
      >
        {inputLabel && (
          <Typography
            sx={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: 1,
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            {inputLabel}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {allowedActions.map((action) => {
            const config = ACTION_CONFIG[action]
            if (!config) return null
            const isLoading = loading === action
            return (
              <Button
                key={action}
                size="small"
                variant="outlined"
                disabled={isLoading || !value.trim()}
                onClick={() => handleAction(action)}
                startIcon={isLoading ? <CircularProgress size={12} color="inherit" /> : config.icon}
                sx={{
                  fontSize: '0.65rem',
                  textTransform: 'none',
                  minWidth: 'auto',
                  py: 0.3,
                  px: 1,
                  color: 'rgba(255,255,255,0.5)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  fontFamily: '"Outfit", sans-serif',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                  },
                  '&.Mui-disabled': {
                    color: 'rgba(255,255,255,0.15)',
                    borderColor: 'rgba(255,255,255,0.04)',
                  },
                }}
              >
                {config.label}
              </Button>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
