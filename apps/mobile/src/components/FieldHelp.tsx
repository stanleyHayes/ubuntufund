import { useState, type ReactElement } from 'react'
import { Keyboard, ScrollView, View, useWindowDimensions } from 'react-native'
import { Dialog, Portal, Text, TextInput } from 'react-native-paper'
import { FIELD_HELP_DISMISS_LABEL, FIELD_HELP_EXAMPLES_LABEL, type FieldHelpContent } from '@ubuntu-fund/types'
import { usePalette } from '@/context/ColorModeContext'
import { fieldHelpAccessibility } from '@/lib/fieldHelp'
import { Button } from './Loading'
import { IconButton } from './RoundedControls'

// A form field's help: a question-mark button that opens a popup explaining the
// field. The copy is a FieldHelpContent from @ubuntu-fund/types, shared with the
// website so both explain a field in the same words.

const ICON = 'help-circle-outline'

function FieldHelpDialog({ help, visible, onDismiss }: { help: FieldHelpContent; visible: boolean; onDismiss: () => void }) {
  const p = usePalette()
  const { height } = useWindowDimensions()
  const text = { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, color: p.text }
  return <Portal>
    <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: height * 0.85 }}>
      <Dialog.Title style={{ fontFamily: 'Outfit_700Bold', color: p.text }}>{help.title}</Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 16 }}>
          {help.body.map(paragraph => <Text key={paragraph} style={text}>{paragraph}</Text>)}
          {help.examples?.length ? <View style={{ gap: 6 }}>
            <Text style={[text, { fontFamily: 'Outfit_700Bold' }]}>{FIELD_HELP_EXAMPLES_LABEL}</Text>
            {help.examples.map(example => <View key={example} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={text} accessibilityElementsHidden importantForAccessibility="no">{'•'}</Text>
              <Text style={[text, { flex: 1 }]}>{example}</Text>
            </View>)}
          </View> : null}
          {help.note ? <Text style={text}>{help.note}</Text> : null}
          {help.footnote ? <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: p.textSecondary }}>{help.footnote}</Text> : null}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions><Button onPress={onDismiss}>{FIELD_HELP_DISMISS_LABEL}</Button></Dialog.Actions>
    </Dialog>
  </Portal>
}

function useHelpDialog(help: FieldHelpContent) {
  const [open, setOpen] = useState(false)
  // Paper's dialog stays centered while the keyboard is up, which can hide its
  // lower half and the Got it button on a small phone, so put the keyboard away.
  const show = () => { Keyboard.dismiss(); setOpen(true) }
  return { show, dialog: <FieldHelpDialog help={help} visible={open} onDismiss={() => setOpen(false)} /> }
}

/**
 * A help button to sit beside a field's label. A tap opens the explanation.
 * There is no tooltip: Paper's is a single line, too short for the summary on
 * a phone, and screen readers already hear the summary as the button's hint.
 */
export function FieldHelp({ help, disabled = false }: { help: FieldHelpContent; disabled?: boolean }) {
  const p = usePalette()
  const { show, dialog } = useHelpDialog(help)
  return <>
    <IconButton icon={ICON} size={20} iconColor={p.textSecondary} disabled={disabled} style={{ margin: 0 }} {...fieldHelpAccessibility(help)} onPress={show} />
    {dialog}
  </>
}

/**
 * Help for a text input, as the icon in its `right` slot, muted like the
 * input's other icons. Its hint reads the summary. Render `dialog` anywhere on
 * the screen.
 */
export function useFieldHelpIcon(help: FieldHelpContent, disabled = false): { icon: ReactElement; dialog: ReactElement } {
  const { show, dialog } = useHelpDialog(help)
  return { icon: <TextInput.Icon icon={ICON} disabled={disabled} forceTextInputFocus={false} {...fieldHelpAccessibility(help)} onPress={show} />, dialog }
}
