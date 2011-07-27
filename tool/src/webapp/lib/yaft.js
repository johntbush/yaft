/*
 * Copyright 2009 The Sakai Foundation
 *
 * Licensed under the Educational Community License, Version 1.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.opensource.org/licenses/ecl1.php
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* Stuff that we always expect to be setup */
var yaftPlacementId = null;
var yaftSiteId = null;
var yaftCurrentUser = null;
var yaftCurrentUserPermissions = null;
var yaftCurrentUserPreferences = null;
var yaftDiscussionUnsubscriptions = null;
var yaftForumUnsubscriptions = null;
var likeServiceAvailable = false;
var yaftCurrentForums = null;
/* Needed for show author messages */
var yaftCurrentAuthors = null;
var yaftGradebookAssignments = null;

/* State specific stuff */
var yaftCurrentForum = null;
var yaftCurrentDiscussion = null;
var yaftViewMode = "full";
var yaftShowingDeleted = false;
var yaftEditor = 'FCKeditor'; //default

(function() {
	// We need the toolbar in a template so we can swap in the translations
	SAKAIUTILS.renderTrimpathTemplate('yaft_toolbar_template',{},'yaft_toolbar');

	$('#yaft_home_link').click(function (e) {
		switchState('forums');
	});

	$('#yaft_add_forum_link').click(function (e) {
		switchState('editForum');
	});

	$('#yaft_add_discussion_link').click(function (e) {
		switchState('startDiscussion');
	});

	$('#yaft_permissions_link').click(function (e) {
		switchState('permissions');
	});

	$('#yaft_minimal_link').click(function (e) {
		switchState('minimal');
	});

	$('#yaft_full_link').click(function (e) {
		switchState('full');
	});

	$('#yaft_show_deleted_link').click(YAFTUTILS.showDeleted);
	$('#yaft_hide_deleted_link').click(YAFTUTILS.hideDeleted);

	$('#yaft_preferences_link').click(function (e) {
		switchState('preferences');
	});

	$('#yaft_authors_view_link').click(function (e) {
		switchState('authors');
	});

	$('#yaft_search_field').change(function(e) {
		YAFTUTILS.showSearchResults(e.target.value);
	});
	
	// This is always showing in every state, so show it here.
	$('#yaft_home_link').show();
	
	var arg = SAKAIUTILS.getParameters();

    if(arg['language']) {
        $.localise('yaft-translations',{language:arg['language'],loadBase: true});
    }
    else {
        $.localise('yaft-translations');
    }

    if (arg.editor) {
        yaftEditor = arg.editor;
    }
	
	if(!arg || !arg.placementId || !arg.siteId) {
		alert('The placement id and site id MUST be supplied as page parameters');
		return;
	}
	
	// Stuff that we always expect to be setup
	yaftPlacementId = arg.placementId;
	yaftSiteId = arg.siteId;
	yaftCurrentUser = SAKAIUTILS.getCurrentUser();

	var data = YAFTUTILS.getCurrentUserData();

    yaftGradebookAssignments = data.assignments;

	yaftCurrentUserPermissions = new YaftPermissions(data.permissions);

	if(yaftCurrentUserPermissions.modifyPermissions)
		$("#yaft_permissions_link").show();
	else
		$("#yaft_permissions_link").hide();
		
	if(arg.viewMode) {
		yaftViewMode = arg.viewMode;
	}
	
	if(arg.likeServiceAvailable && "true" === arg.likeServiceAvailable) {
		likeServiceAvailable = true;
	}

	yaftCurrentUserPreferences = data.preferences;
	yaftDiscussionUnsubscriptions = YAFTUTILS.getDiscussionUnsubscriptions();
	yaftForumUnsubscriptions = YAFTUTILS.getForumUnsubscriptions();
	
	if(yaftCurrentUser != null && yaftCurrentUserPermissions != null) {
		// Now switch into the requested state
		switchState(arg.state,arg);
	} else {
		// TODO: Need to add error message to page
	}
})();

function switchState(state,arg) {

	$("#yaft_minimal_link").hide();
	$("#yaft_full_link").hide();
	$("#yaft_show_deleted_link").hide();
	$("#yaft_hide_deleted_link").hide();
	$("#yaft_add_discussion_link").hide();
	$("#yaft_authors_view_link").hide();

	$('#yaft_feedback_message').hide();

    $('#cluetip').hide();

	// If a forum id has been specified we need to refresh the current forum
	// state. We need to do it here as the breadcrumb in various states uses
	// the information.
	if(arg && arg.forumId) {

		yaftCurrentForum = YAFTUTILS.getForum(arg.forumId,"part");
		YAFTUTILS.setupCurrentForumUnsubscriptions();
	}

	if('forums' === state) {

		if(yaftCurrentUserPermissions.forumCreate)
			$("#yaft_add_forum_link").show();
		else
			$("#yaft_add_forum_link").hide();

		$("#yaft_breadcrumb").html(yaft_forums_label);
		
		YAFTUTILS.setCurrentForums(true);
	}
	else if('authors' === state) {
		$("#yaft_breadcrumb").html(yaft_authors_label);
        YAFTUTILS.getAuthors();
    }
	else if('author' === state) {
		if(!arg.id) {
            return false;
        }

        SAKAIUTILS.renderTrimpathTemplate('yaft_author_messages_breadcrumb_template',{'id':arg.id,'displayName':arg.displayName},'yaft_breadcrumb');

        YAFTUTILS.showAuthorPosts(arg.id);
    }
	else if('forum' === state) {
		
		if(!yaftCurrentForums) {
			YAFTUTILS.setCurrentForums();
		}
		
		if(yaftCurrentUserPermissions.discussionCreate && (!yaftCurrentForum.lockedForWritingAndUnavailable || yaftCurrentUserPermissions.viewInvisible || yaftCurrentUser.id == yaftCurrentForum.creatorId))
			$("#yaft_add_discussion_link").show();
		else
			$("#yaft_add_discussion_link").hide();

		$("#yaft_add_forum_link").hide();
		$("#yaft_show_deleted_link").hide();
		$("#yaft_hide_deleted_link").hide();
		$("#yaft_minimal_link").hide();
		$("#yaft_full_link").hide();
	  		
		SAKAIUTILS.renderTrimpathTemplate('yaft_forum_breadcrumb_template',yaftCurrentForum,'yaft_breadcrumb');

		YAFTUTILS.renderCurrentForumContent();
	}
	else if('full' === state) {
		if(arg && arg.discussionId) {
			yaftCurrentDiscussion = YAFTUTILS.getDiscussion(arg.discussionId);
			YAFTUTILS.markReadMessagesInCurrentDiscussion();
		}
		
		// At this point yaftCurrentForum and yaftCurrentDiscussion must be set
		if(yaftCurrentForum == null) alert("yaftCurrentForum is null");
		if(yaftCurrentDiscussion == null) alert("yaftCurrentDiscussion is null");
			
		yaftViewMode = 'full';

		if(yaftCurrentUserPermissions.messageDeleteAny) {
			if(yaftShowingDeleted) {
				$("#yaft_show_deleted_link").hide();
				$("#yaft_hide_deleted_link").show();
			} else {
				$("#yaft_show_deleted_link").show();
				$("#yaft_hide_deleted_link").hide();
			}
		}
		else {
			$("#yaft_show_deleted_link").hide();
			$("#yaft_hide_deleted_link").hide();
		}

		$("#yaft_add_discussion_link").hide();
		$("#yaft_add_forum_link").hide();
		$("#yaft_minimal_link").show();
		$("#yaft_full_link").hide();
		$("#yaft_authors_view_link").show();
		
		if(yaftCurrentDiscussion != null) {
			SAKAIUTILS.renderTrimpathTemplate('yaft_discussion_breadcrumb_template',yaftCurrentDiscussion,'yaft_breadcrumb');
			SAKAIUTILS.renderTrimpathTemplate('yaft_discussion_content_template',yaftCurrentDiscussion,'yaft_content');

			if(!yaftCurrentDiscussion.lockedForReadingAndUnavailable || yaftCurrentUserPermissions.viewInvisible || yaftCurrentDiscussion.creatorId == yaftCurrentUser.id) {
				SAKAIUTILS.renderTrimpathTemplate('yaft_message_template',yaftCurrentDiscussion.firstMessage,yaftCurrentDiscussion.firstMessage.id);
				renderChildMessages(yaftCurrentDiscussion.firstMessage);
			}
			
			if(yaftCurrentUserPermissions.messageDeleteAny) {
				if(yaftShowingDeleted)
					$(".yaft_deleted_message").show();
				else
					$(".yaft_deleted_message").hide();
			}
		}
		
	   	$(document).ready(function() {
			YAFTUTILS.attachProfilePopup();

	   		if(arg && arg.messageId) {
				//alert('Scrolling to ' + arg.messageId + ' ...');
	   			window.location.hash = arg.messageId;
				$.scrollTo("#"+ arg.messageId);
	   		}

			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
	   	});
	}
	else if('minimal' === state) {

		if(arg && arg.discussionId) {
			yaftCurrentDiscussion = YAFTUTILS.getDiscussion(arg.discussionId);
			YAFTUTILS.markReadMessagesInCurrentDiscussion();
		}

		if(!yaftCurrentDiscussion) {
			if(arg && arg.messageId) {
				yaftCurrentDiscussion = YAFTUTILS.getDiscussionContainingMessage(arg.messageId);
				YAFTUTILS.markReadMessagesInCurrentDiscussion();
			}
		}

		if(!yaftCurrentForum) {
			if(arg && arg.messageId) {
				yaftCurrentForum = YAFTUTILS.getForumContainingMessage(arg.messageId);
			}
		}
			
		// At this point yaftCurrentForum and yaftCurrentDiscussion must be set
		if(yaftCurrentForum == null) alert("yaftCurrentForum is null");
		if(yaftCurrentDiscussion == null) alert("yaftCurrentDiscussion is null");
			
		yaftViewMode = 'minimal';

		$("#yaft_add_discussion_link").hide();
		$("#yaft_show_deleted_link").hide();
		$("#yaft_authors_view_link").show();
		
		var message = null;
		if(arg != null && arg.messageId != null)
			message = YAFTUTILS.findMessage(arg.messageId);
		else
			message = yaftCurrentDiscussion.firstMessage;

		SAKAIUTILS.renderTrimpathTemplate('yaft_message_view_breadcrumb_template',yaftCurrentDiscussion,'yaft_breadcrumb');

		SAKAIUTILS.renderTrimpathTemplate('yaft_message_view_content_template',yaftCurrentDiscussion,'yaft_content');
		SAKAIUTILS.renderTrimpathTemplate('yaft_message_template',yaftCurrentDiscussion.firstMessage,yaftCurrentDiscussion.firstMessage.id);
		$('#' + yaftCurrentDiscussion.firstMessage.id + '_link').hide();
		renderChildMessages(yaftCurrentDiscussion.firstMessage,true);
		YAFTUTILS.attachProfilePopup();

		$('#' + message.id).show();
					
		$("#yaft_minimal_link").hide();
		$("#yaft_full_link").show();
  		$(document).ready(function() {
			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
		});
	}
	else if('editForum' === state) {
		var forum = {'id':'','title':'','description':'',start: -1,end: -1,'groups': []};

		if(arg && arg.forumId)
			forum = YAFTUTILS.findForum(arg.forumId);
			
		var groups = YAFTUTILS.getGroupsForCurrentSite();

		SAKAIUTILS.renderTrimpathTemplate('yaft_edit_forum_breadcrumb_template',arg,'yaft_breadcrumb');
		SAKAIUTILS.renderTrimpathTemplate('yaft_edit_forum_content_template',{'forum':forum,'groups':groups},'yaft_content');

		setupAvailability(forum);
	
	 	$(document).ready(function() {
				for(var i=0,j=forum.groups.length;i<j;i++) {
					$('#' + forum.groups[i].id).attr('checked','true');
				}

	 			$('#yaft_title_field').focus();
	 			$('#yaft_forum_save_button').click(YAFTUTILS.saveForum);
	 			$('#yaft_show_advanced_options_link').click(YAFTUTILS.showAdvancedOptions);
                $('#yaft_hide_advanced_options_link').click(YAFTUTILS.hideAdvancedOptions);
	 			$('#yaft_title_field').keypress(function(e) {
						if(e.keyCode == '13') { // Enter key
							YAFTUTILS.saveForum();
						}
					});
	 			$('#yaft_description_field').keypress(function(e) {
						if(e.keyCode == '13') { // Enter key
							YAFTUTILS.saveForum();
						}
					});
				if(window.frameElement)
					setMainFrameHeight(window.frameElement.id);
	 		});
	}
	else if('editMessage' === state) {
		var message = YAFTUTILS.findMessage(arg.messageId);
		message['editMode'] = 'EDIT';
		SAKAIUTILS.renderTrimpathTemplate('yaft_edit_message_breadcrumb_template',message,'yaft_breadcrumb');
		SAKAIUTILS.renderTrimpathTemplate('yaft_edit_message_content_template',message,'yaft_content');
		
		var saveMessageOptions = { 
			dataType: 'text',
			timeout: 30000,
			iframe: true,
   			success: function(responseText,statusText,xhr) {
					yaftCurrentDiscussion = YAFTUTILS.getDiscussion(yaftCurrentDiscussion.id);
					YAFTUTILS.markReadMessagesInCurrentDiscussion();
					switchState('full');
   				},
   			error : function(xmlHttpRequest,textStatus,errorThrown) {
				}
   			}; 
 
   		$('#yaft_message_form').ajaxForm(saveMessageOptions);
		$('#yaft_message_form').bind('form-pre-serialize', function(event, $form, formOptions, veto) {
		
       		var data = SAKAIUTILS.getEditorData(yaftEditor,'yaft_message_editor');

			if(data == '') {
				$('#yaft_message_editor').val('');
			}
			else {
       			//var instance = SAKAIUTILS.getWysiwygEditor(yaftEditor,'yaft_message_editor');
				SAKAIUTILS.updateEditorElement(yaftEditor,'yaft_message_editor');
				//instance.Events.FireEvent( 'OnAfterLinkedFieldUpdate' );
			}
		});

		jQuery(document).ready(function() {
	    	$('#yaft_attachment').MultiFile(
		            {
		            	max: 5,
					    namePattern: '$name_$i'
					});
		    SAKAIUTILS.setupWysiwygEditor(yaftEditor,'yaft_message_editor',800,500,'Default',yaftSiteId);
			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
	    });
	}
	else if('reply' === state) {
		
		// Look up the message that we are replying to in the current cache
		var messageBeingRepliedTo = YAFTUTILS.findMessage(arg.messageBeingRepliedTo);
						
		// We need to pass a few extra things to the template, so set them.
		messageBeingRepliedTo["mode"] = arg.mode;
		messageBeingRepliedTo["editMode"] = 'REPLY';
		SAKAIUTILS.renderTrimpathTemplate('yaft_edit_message_breadcrumb_template',messageBeingRepliedTo,'yaft_breadcrumb');
		SAKAIUTILS.renderTrimpathTemplate('yaft_reply_message_content_template',messageBeingRepliedTo,'yaft_content');

		var saveMessageOptions = { 
			dataType: 'text',
			timeout: 30000,
			iframe: true,
   			success: function(responseText,statusText,xhr) {
					yaftCurrentDiscussion = YAFTUTILS.getDiscussion(yaftCurrentDiscussion.id);
					YAFTUTILS.markReadMessagesInCurrentDiscussion();
					switchState('full');
   				},
   			error : function(xmlHttpRequest,textStatus,errorThrown) {
				}
   			}; 
 
   		$('#yaft_message_form').ajaxForm(saveMessageOptions);
		$('#yaft_message_form').bind('form-pre-serialize', function(event, $form, formOptions, veto) {

       		var data = SAKAIUTILS.getEditorData(yaftEditor,'yaft_message_editor');
		
			if(data == '') {
				$('#yaft_message_editor').val('');
			}
			else {
       			//var instance = SAKAIUTILS.getWysiwygEditor(yaftEditor,'yaft_message_editor');
				SAKAIUTILS.updateEditorElement(yaftEditor,'yaft_message_editor');
				//instance.Events.FireEvent( 'OnAfterLinkedFieldUpdate' );
			}
		});

	  	jQuery(document).ready(function() {
			$('#yaft_attachment').MultiFile(
			{
				max: 5,
				namePattern: '$name_$i'
			});
				
			SAKAIUTILS.setupWysiwygEditor(yaftEditor,'yaft_message_editor',800,500,'Default',yaftSiteId);
			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
	 	});
	}
	else if('startDiscussion' === state) {

		var discussion = {'id':'','subject':'',lockedForWriting:yaftCurrentForum.lockedForWriting,lockedForReading:yaftCurrentForum.lockedForReading,start: yaftCurrentForum.start,end: yaftCurrentForum.end,'firstMessage':{'content':''},'grade': false};

		if(arg && arg.discussionId) {
			discussion = YAFTUTILS.findDiscussion(arg.discussionId);
        }

		SAKAIUTILS.renderTrimpathTemplate('yaft_start_discussion_breadcrumb_template',arg,'yaft_breadcrumb');
		SAKAIUTILS.renderTrimpathTemplate('yaft_start_discussion_content_template',discussion,'yaft_content');
		
		var saveDiscussionOptions = { 
			dataType: 'html',
			iframe: true,
			timeout: 30000,
			beforeSerialize: function($form,options) {
					var startDate = (+$('#yaft_start_date_millis').val());
					var startHours = (+$('#yaft_start_hours').val());
					var startMinutes = (+$('#yaft_start_minutes').val());
					startDate += (startHours * 3600000) + (startMinutes * 60000);
					$('#yaft_start_date_millis').val(startDate);

					var endDate = (+$('#yaft_end_date_millis').val());
					var endHours = (+$('#yaft_end_hours').val());
					var endMinutes = (+$('#yaft_end_minutes').val());
					endDate += (endHours * 3600000) + (endMinutes * 60000);
					$('#yaft_end_date_millis').val(endDate);
				},
			beforeSubmit: function(arr, $form, options) {
                    for(var i=0,j=arr.length;i<j;i++) {
                    	if('subject' === arr[i].name) {
                        	if(!arr[i].value || arr[i].value.length < 4) {
                            	alert("You must supply a subject of at least 4 characters");
                                return false;
                            }
                     	}
                  	}
            	},
   			success: function(responseText,statusText,xhr) {
   					if(responseText.match(/^ERROR.*/)) {
   						alert("Failed to create/edit discussion");
   					}
   					else {
						var discussion = YAFTUTILS.getDiscussion(responseText);
						if(!arg || !arg.discussionId) {
							yaftCurrentForum.discussions.push(discussion);
						}
						else {
							for(var i = 0,j = yaftCurrentForum.discussions.length;i<j;i++) {
								if(responseText === yaftCurrentForum.discussions[i].id) {
									yaftCurrentForum.discussions.splice(i,1,discussion);
									break;
								}
							}
						}
						switchState('forum');
					}
   				},
   			error : function(xmlHttpRequest,textStatus,errorThrown) {
   				alert("Failed to create/edit discussion");
				}
   			}; 
 
   		$('#yaft_discussion_form').ajaxForm(saveDiscussionOptions);
		$('#yaft_discussion_form').bind('form-pre-serialize', function(event, $form, formOptions, veto)
   		{
       		var data = SAKAIUTILS.getEditorData(yaftEditor,'yaft_discussion_editor');

			if(data == '') {
				$('#yaft_discussion_editor').val('');
			}
			else {
       			//var instance = SAKAIUTILS.getWysiwygEditor(yaftEditor,'yaft_discussion_editor');
				SAKAIUTILS.updateEditorElement(yaftEditor,'yaft_discussion_editor');
				//instance.Events.FireEvent( 'OnAfterLinkedFieldUpdate' );
			}
		});

		setupAvailability(discussion);

   		$(document).ready(function() {
	 		$('#yaft_show_advanced_options_link').click(YAFTUTILS.showAdvancedOptions);
            $('#yaft_hide_advanced_options_link').click(YAFTUTILS.hideAdvancedOptions);
	    	$('#yaft_attachment').MultiFile(
		            {
		            	max: 5,
					    namePattern: '$name_$i'
					});
			SAKAIUTILS.setupWysiwygEditor(yaftEditor,'yaft_discussion_editor',800,500,'Default',yaftSiteId);
			$('#yaft_subject_field').focus();

            if(yaftGradebookAssignments && yaftGradebookAssignments.length > 0) {
                $('#yaft_grading_fieldset').show();
            }

			$('#yaft_grade_checkbox').click(function () {
                if(this.checked === true) {
                    $('#yaft_assignment_selector').show();
                } else {
                    $('#yaft_assignment_selector').hide();
                }
            });

	        if(discussion.assignment) {
		        $('#yaft_grade_checkbox').attr('checked',true);
                $('#yaft_assignment_selector').show();
                $("#yaft_assignment_selector option[value='" + discussion.assignment.id + "']").attr('selected', 'selected');
            }

			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
   		});
	}
	else if('moveDiscussion' === state) {
		SAKAIUTILS.renderTrimpathTemplate('yaft_move_discussion_breadcrumb_template',arg,'yaft_breadcrumb');
		
		YAFTUTILS.setCurrentForums();
		var discussion = null;
		jQuery.ajax( {
			url : "/portal/tool/" + yaftPlacementId + "/discussions/" + arg.discussionId,
			dataType : "json",
			async : false,
			cache: false,
			success : function(d,textStatus) {
				discussion = d;
			},
			error : function(xhr,textStatus,errorThrown) {
				alert("Failed to get discussion. Reason: " + errorThrown);
			}
		});
				
		SAKAIUTILS.renderTrimpathTemplate('yaft_move_discussion_content_template',{'forums':yaftCurrentForums,'discussion':discussion},'yaft_content');
		
		$(document).ready(function() {
			var moveDiscussionOptions = { 
				dataType: 'text',
				timeout: 30000,
				async: false,
 				success: function(responseText,statusText,xhr) {
					switchState('forums');
   				},
   				error : function(xmlHttpRequest,textStatus,errorThrown) {
				}
  			}; 
 
   			$('#yaft_move_discussion_form').ajaxForm(moveDiscussionOptions);
			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
		});
	}
	else if('permissions' === state) {
		var perms = YAFTUTILS.getSitePermissionMatrix();
		SAKAIUTILS.renderTrimpathTemplate('yaft_permissions_content_template',{'perms':perms},'yaft_content');

	 	$(document).ready(function() {
			$('#yaft_permissions_save_button').click(function (e) {
				return YAFTUTILS.savePermissions();
			});

			$('#yaft_permissions_table tbody tr:odd').addClass('yaft_odd_row');

			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
		});
	}
	else if('preferences' === state) {
		SAKAIUTILS.renderTrimpathTemplate('yaft_preferences_breadcrumb_template',arg,'yaft_breadcrumb');
		SAKAIUTILS.renderTrimpathTemplate('yaft_preferences_template',{},'yaft_content');
		$('#yaft_email_' + yaftCurrentUserPreferences.email + '_option').attr('checked',true);
		$('#yaft_view_' + yaftCurrentUserPreferences.view + '_option').attr('checked',true);
	 	$(document).ready(function() {
	 		var savePreferencesOptions = { 
				dataType: 'json',
				timeout: 30000,
				async: false,
   				success: function(preferences,statusText,xhr) {
   					yaftCurrentUserPreferences = preferences;
					switchState('forums');
   				},
   				error : function(xmlHttpRequest,textStatus,errorThrown) {
				}
   			}; 
 
   			$('#yaft_preferences_form').ajaxForm(savePreferencesOptions);
   			
			if(window.frameElement)
				setMainFrameHeight(window.frameElement.id);
	 	});
	}
	else if('unsubscribed' === state) {
		SAKAIUTILS.renderTrimpathTemplate('yaft_unsubscribed_template',{},'yaft_content');
	}

	return false;
}

function renderChildMessages(parent,skipDeleted) {
	var children = parent.children;
	
	for(var i=0,j=children.length;i<j;i++) {
		var message = children[i];

		if(message.status !== 'DELETED' || !skipDeleted) {
			var element = document.getElementById(message.id);
        	if(element) {
            	SAKAIUTILS.renderTrimpathTemplate('yaft_message_template',message,message.id);
            }
		}

		renderChildMessages(message,skipDeleted);
	}
}

/**
 *	Used when in the minimal view
 */
function yaftShowMessage(messageId) {
	var message = YAFTUTILS.findMessage(messageId);
	$('.yaft_full_message').hide();
	$('.yaft_message_minimised').show();
	$('#' + message.id).show();
	$('#' + message.id + '_link').hide();
   	$(document).ready(function() {
		if(window.frameElement)
			setMainFrameHeight(window.frameElement.id);
	});
}

function setupAvailability(element) {

	var startDate = $('#yaft_start_date');
	var endDate = $('#yaft_end_date');

	if(element.start != -1 && element.end != -1) {
		startDate.attr('disabled',false);
		startDate.css('background-color','white');
		$('#yaft_start_hour_selector').attr('disabled',false);
		$('#yaft_start_hour_selector').css('background-color','white');
		$('#yaft_start_minute_selector').attr('disabled',false);
		$('#yaft_start_minute_selector').css('background-color','white');
		endDate.attr('disabled',false);
		endDate.css('background-color','white');
		$('#yaft_end_hour_selector').attr('disabled',false);
		$('#yaft_end_hour_selector').css('background-color','white');
		$('#yaft_end_minute_selector').attr('disabled',false);
		$('#yaft_end_minute_selector').css('background-color','white');

		var start = new Date(element.start);
		startDate.val(start.getDate() + ' ' + (1 + start.getMonth()) + ' ' + start.getFullYear());

		var hours = start.getHours();
		if(hours < 10)  hours = '0' + hours;
		var minutes = start.getMinutes();
		if(minutes == 0) minutes += '0';

		$('#yaft_start_hour_selector option:contains(' + hours + ')').attr('selected','selected');
		$('#yaft_start_minute_selector option:contains(' + minutes + ')').attr('selected','selected');

		var end = new Date(element.end);
		endDate.val(end.getDate() + ' ' + (1 + end.getMonth()) + ' ' + end.getFullYear());

		hours = end.getHours();
		if(hours < 10)  hours = '0' + hours;
			minutes = end.getMinutes();
		if(minutes == 0) minutes += '0';

		$('#yaft_end_hour_selector option:contains(' + hours + ')').attr('selected','selected');
		$('#yaft_end_minute_selector option:contains(' + minutes + ')').attr('selected','selected');
	}

	var writingCheckbox = $('#yaft_lock_writing_checkbox');

	var readingCheckbox = $('#yaft_lock_reading_checkbox');

	if(element.lockedForWriting)
		$('#yaft_lock_writing_checkbox').attr('checked',true);

	if(element.lockedForReading)
		$('#yaft_lock_reading_checkbox').attr('checked',true);
		
	startDate.datepicker({
		altField: '#yaft_start_date_millis',
		altFormat: '@',
		dateFormat: 'dd mm yy',
		defaultDate: new Date(),
		minDate: new Date(),
		hideIfNoPrevNext: true
	});

	endDate.datepicker({
		altField: '#yaft_end_date_millis',
		altFormat: '@',
		dateFormat: 'dd mm yy',
		defaultDate: new Date(),
		minDate: new Date(),
		hideIfNoPrevNext: true
	});
}
