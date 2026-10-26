import { fireEvent, render } from '@testing-library/react-native';
import { Conversation, type ConversationProps } from '@/features/conversation/conversation-screen';
import { LocalizationProvider } from '@/i18n/provider';
import { household, me, partner } from '../test/fixtures/payments';
import type { Comment } from '@/features/conversation/schema';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('expo-crypto', () => { let n=900; return { randomUUID: () => `00000000-0000-4000-8000-${String(n++).padStart(12,'0')}` }; });
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/conversation/api', () => ({ useConversation: jest.fn(), useConversationAction: jest.fn() }));
jest.mock('@/features/expenses/api', () => ({ useExpense: jest.fn() }));
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/hooks/use-session', () => ({ useSession: jest.fn() }));
const tid='00000000-0000-4000-8000-000000000100';
const own: Comment={id:'00000000-0000-4000-8000-000000000101',household_id:household.id,transaction_id:tid,author_id:me.userId,
  body:'Thanks for grabbing coffee ☕',version:1,created_at:'2026-10-26T08:00:00Z',updated_at:'2026-10-26T08:00:00Z',deleted_at:null};
const props: ConversationProps={householdId:household.id,userId:me.userId,members:[me,partner],currency:'USD',timezone:household.timezone,
  expense:{id:tid,categoryId:'cat',frequency:'one_time',scheduledPaymentRef:null,version:1,amountMinor:2500,description:'Our coffee',occurredOn:'2026-10-26'},
  comments:[{...own,id:'partner',author_id:partner.userId,body:'You are welcome'},own],
  reactions:[{household_id:household.id,transaction_id:tid,author_id:me.userId,kind:'heart'}],commentsError:false,reactionsError:false,parentError:false,
  onAction:jest.fn(async()=>{}),onRefresh:jest.fn(),hasOlder:false,loadingOlder:false,onOlder:jest.fn()};
const show=(patch:Partial<ConversationProps>={})=>render(<LocalizationProvider><Conversation {...props} {...patch}/></LocalizationProvider>);
beforeEach(()=>jest.clearAllMocks());
it('shows shared discussion with author-only controls and a selected reaction',async()=>{
 const view=await show();expect(view.getByText('Our coffee')).toBeTruthy();expect(view.getByText('You are welcome')).toBeTruthy();
 expect(view.getAllByRole('button',{name:'Edit my comment'})).toHaveLength(1);
 const heart=view.getByRole('button',{name:'Love · 1 reactions'});expect(heart.props.accessibilityState.selected).toBe(true);
 await fireEvent.press(heart);expect(props.onAction).toHaveBeenCalledWith({kind:'react',reaction:'heart',active:false});
});
it('posts a comment, clears only after success and uses a stable id on failed retry',async()=>{
 const action=jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined);
 const view=await show({onAction:action});await fireEvent.changeText(view.getByLabelText('Add a comment'),'A lovely coffee');
 await fireEvent.press(view.getByRole('button',{name:'Post comment'}));
 expect(view.getByLabelText('Add a comment').props.value).toBe('A lovely coffee');
 await fireEvent.press(view.getByRole('button',{name:'Post comment'}));
 expect(action.mock.calls[0][0].id).toBe(action.mock.calls[1][0].id);
 expect(view.getByLabelText('Add a comment').props.value).toBe('');expect(view.getByText('Comment saved.')).toBeTruthy();
});
it('retains a new draft while editing a comment and after a failed background refresh',async()=>{
 const view=await show();await fireEvent.changeText(view.getByLabelText('Add a comment'),'Unsent new thought');
 await fireEvent.press(view.getByRole('button',{name:'Edit my comment'}));
 await fireEvent.changeText(view.getByLabelText('Edit your comment'),'Edited draft');
 await view.rerender(<LocalizationProvider><Conversation {...props} commentsError/></LocalizationProvider>);
 expect(view.getByLabelText('Edit your comment').props.value).toBe('Edited draft');
 await fireEvent.press(view.getByRole('button',{name:'Cancel'}));
 expect(view.getByLabelText('Add a comment').props.value).toBe('Unsent new thought');
});
it('recovers a stale edit through explicit review while preserving the authored draft',async()=>{
 const action=jest.fn().mockRejectedValueOnce({message:'Comment changed'}).mockResolvedValue(undefined);
 const view=await show({onAction:action});await fireEvent.press(view.getByRole('button',{name:'Edit my comment'}));
 await fireEvent.changeText(view.getByLabelText('Edit your comment'),'Updated thanks');
 await fireEvent.press(view.getByRole('button',{name:'Save changes'}));expect(action.mock.calls[0][0].version).toBe(1);
 await fireEvent.press(view.getAllByRole('button',{name:'Refresh conversation'})[0]);expect(props.onRefresh).toHaveBeenCalled();
 await view.rerender(<LocalizationProvider><Conversation {...props} onAction={action} comments={[{...own,version:2,body:'Saved elsewhere'}]}/></LocalizationProvider>);
 expect(view.getByLabelText('Edit your comment').props.value).toBe('Updated thanks');
 expect(view.getByRole('button',{name:'Save changes'}).props.accessibilityState.disabled).toBe(true);
 expect(view.getByText('Latest saved comment')).toBeTruthy();
 await fireEvent.press(view.getByRole('button',{name:'Keep my draft and use this version'}));
 expect(view.getByLabelText('Edit your comment').props.value).toBe('Updated thanks');
 await fireEvent.press(view.getByRole('button',{name:'Save changes'}));
 expect(action.mock.calls[1][0]).toEqual({kind:'save',id:own.id,version:2,body:'Updated thanks'});
});
it('requires review and a new confirmation to remove a refreshed changed comment',async()=>{
 const action=jest.fn().mockRejectedValueOnce({message:'Comment changed'}).mockResolvedValue(undefined);
 const view=await show({onAction:action});await fireEvent.press(view.getByRole('button',{name:'Remove my comment'}));
 await fireEvent.press(view.getByRole('button',{name:'Yes, remove my comment'}));expect(action.mock.calls[0][0].version).toBe(1);
 await fireEvent.press(view.getAllByRole('button',{name:'Refresh conversation'})[0]);
 await view.rerender(<LocalizationProvider><Conversation {...props} onAction={action} comments={[{...own,version:2,body:'Latest text to review'}]}/></LocalizationProvider>);
 expect(view.getByRole('button',{name:'Yes, remove my comment'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(view.getByRole('button',{name:'Use this version for removal'}));
 expect(action).toHaveBeenCalledTimes(1);
 await fireEvent.press(view.getByRole('button',{name:'Yes, remove my comment'}));
 expect(action.mock.calls[1][0]).toEqual({kind:'remove',id:own.id,version:2});
});
it('confirms removal and displays a removed comment without edit controls',async()=>{
 const view=await show();await fireEvent.press(view.getByRole('button',{name:'Remove my comment'}));
 expect(props.onAction).not.toHaveBeenCalled();await fireEvent.press(view.getByRole('button',{name:'Yes, remove my comment'}));
 expect(props.onAction).toHaveBeenCalledWith({kind:'remove',id:own.id,version:1});
 await view.rerender(<LocalizationProvider><Conversation {...props} comments={[{...own,body:'',deleted_at:'2026-10-26T09:00:00Z',version:2}]}/></LocalizationProvider>);
 expect(view.getByText('Comment removed')).toBeTruthy();expect(view.queryByRole('button',{name:'Edit my comment'})).toBeNull();
});
it('does not fabricate empty history or reaction counts on errors and offers pagination/recovery',async()=>{
 const view=await show({commentsError:true,reactionsError:true});
 expect(view.queryByText('No comments yet. A small thank-you can go a long way.')).toBeNull();
 expect(view.queryByRole('button',{name:'Love · 0 reactions'})).toBeNull();
 await fireEvent.press(view.getAllByRole('button',{name:'Try again'})[0]);expect(props.onRefresh).toHaveBeenCalled();
 await view.rerender(<LocalizationProvider><Conversation {...props} hasOlder/></LocalizationProvider>);
 await fireEvent.press(view.getByRole('button',{name:'Load older comments'}));expect(props.onOlder).toHaveBeenCalled();
});
it('rejects whitespace/over-limit input and prevents sends while the parent expense is unavailable',async()=>{
 const view=await show();await fireEvent.changeText(view.getByLabelText('Add a comment'),' \n\t ');
 expect(view.getByRole('button',{name:'Post comment'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(view.getByLabelText('Add a comment'),'a'.repeat(1001));
 expect(view.getByRole('button',{name:'Post comment'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(view.getByLabelText('Add a comment'),'Valid');
 await view.rerender(<LocalizationProvider><Conversation {...props} parentError/></LocalizationProvider>);
 expect(view.getByRole('button',{name:'Post comment'}).props.accessibilityState.disabled).toBe(true);
});
