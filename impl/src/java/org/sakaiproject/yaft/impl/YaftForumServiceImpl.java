package org.sakaiproject.yaft.impl;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Stack;

import net.sf.json.JSONObject;

import org.apache.log4j.Logger;
import org.sakaiproject.entity.api.Entity;
import org.sakaiproject.entity.api.HttpAccess;
import org.sakaiproject.entity.api.Reference;
import org.sakaiproject.entity.api.ResourceProperties;
import org.sakaiproject.yaft.api.Discussion;
import org.sakaiproject.yaft.api.Forum;
import org.sakaiproject.yaft.api.Message;
import org.sakaiproject.yaft.api.SakaiProxy;
import org.sakaiproject.yaft.api.SearchResult;
import org.sakaiproject.yaft.api.XmlDefs;
import org.sakaiproject.yaft.api.YaftForumService;
import org.sakaiproject.yaft.api.YaftFunctions;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

public class YaftForumServiceImpl implements YaftForumService
{
	private Logger logger = Logger.getLogger(YaftForumServiceImpl.class);
	
	private SakaiProxy sakaiProxy = null;
	private YaftPersistenceManager persistenceManager = null;
	
	public void init()
	{
		if(logger.isDebugEnabled()) logger.debug("init()");
		
		sakaiProxy = new SakaiProxyImpl();
		
		logger.info("Registering Yaft functions ...");

		sakaiProxy.registerFunction(YaftFunctions.YAFT_MODIFY_PERMISSIONS);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_FORUM_CREATE);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_FORUM_DELETE_OWN);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_FORUM_DELETE_ANY);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_DISCUSSION_CREATE);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_DISCUSSION_DELETE_OWN);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_DISCUSSION_DELETE_ANY);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_MESSAGE_CREATE);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_MESSAGE_CENSOR);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_MESSAGE_DELETE_OWN);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_MESSAGE_DELETE_ANY);
		sakaiProxy.registerFunction(YaftFunctions.YAFT_MESSAGE_READ);
		
		persistenceManager = new YaftPersistenceManager();
		persistenceManager.setSakaiProxy(sakaiProxy);
		persistenceManager.init();
		persistenceManager.setupTables();
		
		sakaiProxy.registerEntityProducer(this);
	}
	
	public Forum getForum(String forumId,String state)
	{
		if(logger.isDebugEnabled()) logger.debug("getForum()");
		
		Forum forum = persistenceManager.getForum(forumId,state);
		
		return forum;
	}
	
	public Discussion getDiscussion(String discussionId,boolean fully)
	{
		if(logger.isDebugEnabled()) logger.debug("getDiscussion()");
		
		return persistenceManager.getDiscussion(discussionId,fully);
	}

	public List<Forum> getSiteForums(String siteId,boolean fully)
	{
		if(logger.isDebugEnabled()) logger.debug("getSiteForums()");
		List<Forum> fora = persistenceManager.getFora(siteId,fully);
		return fora;
	}
	
	public void addOrUpdateForum(Forum forum)
	{
		if(logger.isDebugEnabled()) logger.debug("addOrUpdateForum()");
		
		persistenceManager.addOrUpdateForum(forum);
		
		String reference = YaftForumService.REFERENCE_ROOT + "/" + sakaiProxy.getCurrentSiteId() + "/forums/" + forum.getId();
		sakaiProxy.postEvent(YAFT_FORUM_CREATED,reference,true);
	}
	
	public SakaiProxy getSakaiProxy()
	{
		return sakaiProxy;
	}

	public void addOrUpdateMessage(String forumId,Message message,boolean sendMail)
	{
		if(logger.isDebugEnabled()) logger.debug("addOrUpdateMessage()");
		
		String discussionId = message.getDiscussionId();
		
		persistenceManager.addOrUpdateMessage(forumId,message);
		//persistenceManager.markMessageRead(message.getId(), forumId, message.getDiscussionId());
		
		String reference = YaftForumService.REFERENCE_ROOT + "/" + sakaiProxy.getCurrentSiteId() + "/messages/" + message.getId();
		sakaiProxy.postEvent(YAFT_MESSAGE_CREATED,reference,true);
		
		if(sendMail && "READY".equals(message.getStatus()))
		{
			Discussion discussion = persistenceManager.getDiscussion(discussionId,false);
		
			List<String> unsubscribers = persistenceManager.getDiscussionUnsubscribers(discussionId);
		
			String url = sakaiProxy.getDirectUrl("/messages/"
							+ message.getId());
		
			sakaiProxy.sendEmailMessageToSiteUsers("New Sakai Forum Message",message.getCreatorDisplayName() + " updated the message titled '<a href=\"" + url + "\">" + message.getSubject() + "</a>' at discussion '" + discussion.getSubject() + "'"
													,unsubscribers);
		}
	}
	
	public Discussion addDiscussion(String forumId,Message message,boolean sendMail)
	{
		if(logger.isDebugEnabled()) logger.debug("addDiscussion()");
		
		persistenceManager.addOrUpdateMessage(forumId,message);
		//persistenceManager.markMessageRead(message.getId(), forumId, message.getId());
		
		String reference = YaftForumService.REFERENCE_ROOT + "/" + sakaiProxy.getCurrentSiteId() + "/discussions/" + message.getId();
		sakaiProxy.postEvent(YAFT_DISCUSSION_CREATED,reference,true);
		
		String discussionId = message.getId();
		
		Discussion discussion = persistenceManager.getDiscussion(discussionId,false);
		
		if(sendMail)
		{
			List<String> unsubscribers = persistenceManager.getDiscussionUnsubscribers(discussionId);
		
			String url = sakaiProxy.getDirectUrl("/messages/"
							+ message.getId());
		
			sakaiProxy.sendEmailMessageToSiteUsers("New Sakai Forum Message",message.getCreatorDisplayName() + " started a new discussion titled '<a href=\"" + url + "\">" + discussion.getSubject() + "'"
													,unsubscribers);
		}
		
		return discussion;
	}
	
	public List<Forum> getFora()
	{
		if(logger.isDebugEnabled()) logger.debug("getFora()");
		
		List<Forum> fora = persistenceManager.getFora();
		
		for(Forum forum : fora)
		{
			forum.setDiscussions(getForumDiscussions(forum.getId(), false));
			//forum.setUrl(sakaiProxy.getDirectUrl("/forums/" + forum.getId()));
		}
		
		return fora;
	}

	public List<Discussion> getForumDiscussions(String forumId,boolean fully)
	{
		if(logger.isDebugEnabled()) logger.debug("getForumDiscussions(" + forumId + ")");
		
		return persistenceManager.getForumDiscussions(forumId,fully);
	}

	public List<Message> getMessages()
	{
		if(logger.isDebugEnabled()) logger.debug("getMessages()");
		
		return persistenceManager.getMessages();
	}

	public void deleteForum(String forumId)
	{
		persistenceManager.deleteForum(forumId);
		String reference = YaftForumService.REFERENCE_ROOT + "/" + sakaiProxy.getCurrentSiteId() + "/forums/" + forumId;
		sakaiProxy.postEvent(YAFT_FORUM_DELETED,reference,true);
	}

	public boolean deleteDiscussion(String discussionId)
	{
		if(persistenceManager.deleteDiscussion(discussionId))
		{
			String reference = YaftForumService.REFERENCE_ROOT + "/" + sakaiProxy.getCurrentSiteId() + "/discussions/" + discussionId;
			sakaiProxy.postEvent(YAFT_DISCUSSION_DELETED,reference,true);
			return true;
		}
		
		return false;
	}

	public void censorMessage(String messageId)
	{
		persistenceManager.censorMessage(messageId);
	}
	
	public void deleteMessage(Message message,String forumId)
	{
		persistenceManager.deleteMessage(message,forumId);
		String reference = YaftForumService.REFERENCE_ROOT + "/" + sakaiProxy.getCurrentSiteId() + "/messages/" + message.getId();
		sakaiProxy.postEvent(YAFT_MESSAGE_DELETED,reference,true);
	}
	
	public void undeleteMessage(Message message,String forumId)
	{
		persistenceManager.undeleteMessage(message,forumId);
	}

	public void unsubscribeFromDiscussion(String userId, String discussionId)
	{
		if(userId == null)
			userId = sakaiProxy.getCurrentUser().getId();
		
		persistenceManager.unsubscribeFromDiscussion(userId,discussionId);
	}
	
	public List<String> getDiscussionUnsubscriptions(String userId)
	{
		if(userId == null)
			userId = sakaiProxy.getCurrentUser().getId();
		
		return persistenceManager.getDiscussionUnsubscriptions(userId);
	}

	public void subscribeToDiscussion(String userId, String discussionId)
	{
		if(userId == null)
			userId = sakaiProxy.getCurrentUser().getId();
		
		persistenceManager.subscribeToDiscussion(userId,discussionId);
	}

	public void showMessage(Message message)
	{
		persistenceManager.showMessage(message);
	}

	public void deleteAttachment(String attachmentId, String messageId)
	{
		persistenceManager.deleteAttachment(attachmentId,messageId);
	}

	public Message getMessage(String messageId)
	{
		return persistenceManager.getMessage(messageId);
	}

	public Forum getForumContainingMessage(String messageId)
	{
		return persistenceManager.getForumContainingMessage(messageId);
	}

	public List<SearchResult> search(String searchTerms)
	{
		return persistenceManager.search(searchTerms);
	}

	public boolean markMessageRead(String messageId,String forumId,String discussionId)
	{
		return persistenceManager.markMessageRead(messageId,forumId,discussionId);
	}

	public boolean markMessageUnRead(String messageId, String forumId,String discussionId)
	{
		return persistenceManager.markMessageUnRead(messageId,forumId,discussionId);
	}
	
	public boolean markDiscussionRead(String discussionId,String forumId)
	{
		return persistenceManager.markDiscussionRead(discussionId,forumId);
	}

	public List<String> getReadMessageIds(String discussionId)
	{
		return persistenceManager.getReadMessageIds(discussionId);
	}

	public void moveDiscussion(String discussionId, String currentForumId,String newForumId)
	{
		persistenceManager.moveDiscussion(discussionId,currentForumId,newForumId);
	}

	public void publishMessage(String forumId,Message message)
	{
		persistenceManager.publishMessage(forumId,message.getId());
		
		Discussion discussion = persistenceManager.getDiscussion(message.getDiscussionId(),false);
		
		List<String> unsubscribers = persistenceManager.getDiscussionUnsubscribers(message.getDiscussionId());
		
		String url = sakaiProxy.getDirectUrl("/messages/"
						+ message.getId());
		
		sakaiProxy.sendEmailMessageToSiteUsers("New Sakai Forum Message",message.getCreatorDisplayName() + " added a message titled '<a href=\"" + url + "\">" + message.getSubject() + "</a>' at discussion '" + discussion.getSubject() + "'"
												,unsubscribers);
	}
	
	public byte[] getProfile2Picture(String userId)
	{
		return persistenceManager.getProfile2Picture(userId);
	}
	
	/** START EntityProducer IMPLEMENTATION */

	public String archive(String siteId, Document doc, Stack stack, String archivePath, List attachments)
	{
		if (logger.isDebugEnabled())
			logger.debug("archive(siteId:" + siteId + ",archivePath:" + archivePath + ")");

		StringBuilder results = new StringBuilder();

		results.append(getLabel() + ": Started.\n");

		int forumCount = 0;

		try
		{
			// start with an element with our very own (service) name
			Element element = doc.createElement(YaftForumService.class.getName());
			element.setAttribute("version", "2.5.x");
			((Element) stack.peek()).appendChild(element);
			stack.push(element);

			Element forums = doc.createElement("forums");
			element.appendChild(forums);
			stack.push(forums);
			List<Forum> fora = getSiteForums(siteId,true);
			if (fora != null && fora.size() > 0)
			{
				for (Forum forum : fora)
				{
					forum.toXml(doc, stack);
					forumCount++;
				}
			}

			stack.pop();

			results.append(getLabel() + ": Finished. " + forumCount + " forum(s) archived.\n");
		}
		catch (Exception any)
		{
			results.append(getLabel() + ": exception caught. Message: " + any.getMessage());
			logger.warn(getLabel() + " exception caught. Message: " + any.getMessage());
		}

		stack.pop();

		return results.toString();
	}

	public Entity getEntity(Reference reference)
	{
		// TODO Auto-generated method stub
		String referenceString = reference.getReference();
		String[] parts = referenceString.split(Entity.SEPARATOR);
		
		if(!parts[0].equals(REFERENCE_ROOT))
			return null;
		
		String type = parts[1];
		
		String id = parts[2];
		
		if("messages".equals(type))
		{
			return getMessage(id);
		}
		
		return null;
	}

	public Collection getEntityAuthzGroups(Reference arg0, String arg1)
	{
		// TODO Auto-generated method stub
		return null;
	}

	public String getEntityDescription(Reference arg0)
	{
		// TODO Auto-generated method stub
		return null;
	}

	public ResourceProperties getEntityResourceProperties(Reference arg0)
	{
		// TODO Auto-generated method stub
		return null;
	}

	public String getEntityUrl(Reference reference)
	{
		String referenceString = reference.getReference();
		return null;
	}

	public HttpAccess getHttpAccess()
	{
		// TODO Auto-generated method stub
		return null;
	}

	public String getLabel()
	{
		return ENTITY_PREFIX;
	}

	public String merge(String siteId, Element root, String archivePath, String fromSiteId, Map attachmentNames, Map userIdTrans, Set userListAllowImport)
	{
		logger.debug("merge(siteId:" + siteId + ",root tagName:" + root.getTagName() + ",archivePath:" + archivePath + ",fromSiteId:" + fromSiteId);
		
		StringBuilder results = new StringBuilder();

		try
		{
			int forumCount = 0;

			NodeList forumNodes = root.getElementsByTagName(XmlDefs.FORUM);
			final int numberForums = forumNodes.getLength();

			for (int i = 0; i < numberForums; i++)
			{
				Node child = forumNodes.item(i);
				if (child.getNodeType() != Node.ELEMENT_NODE)
				{
					// Problem
					continue;
				}

				Element forumElement = (Element) child;

				Forum forum = new Forum();
				forum.fromXml(forumElement);
				forum.setSiteId(siteId);

				addOrUpdateForum(forum);
				
				NodeList discussionNodes = forumElement.getElementsByTagName(XmlDefs.DISCUSSION);
				
				for(int j = 0;j < discussionNodes.getLength();j++)
				{
					Node discussionNode = discussionNodes.item(j);
					NodeList discussionChildNodes  = discussionNode.getChildNodes();
					for(int k = 0;k<discussionChildNodes.getLength();k++)
					{
						Node discussionChildNode = discussionChildNodes.item(k);
						if(discussionChildNode.getNodeType() == Node.ELEMENT_NODE && XmlDefs.MESSAGES.equals(((Element)discussionChildNode).getTagName()))
						{
							NodeList messageNodes = discussionChildNode.getChildNodes();
							mergeDescendantMessages(siteId,forum.getId(),null,null,messageNodes,results);
							break;
						}
					}
				}
				
				forumCount++;
			}

			results.append("Stored " + forumCount + " forums.");
		}
		catch (Exception e)
		{
			e.printStackTrace();
		}

		return results.toString();
	}
	
	private void mergeDescendantMessages(String siteId,String forumId,String discussionId,String parentId,NodeList messageNodes,StringBuilder results)
	{
		for(int i = 0;i<messageNodes.getLength();i++)
		{
			Node node = messageNodes.item(i);
			
			if(node.getNodeType() != Node.ELEMENT_NODE)
				continue;
			
			Element messageElement = (Element) node;
			
			if(!"message".equals(messageElement.getTagName()))
				continue;
			
			Message message = new Message();
			message.fromXml(messageElement);
			message.setParent(parentId);
			message.setSiteId(siteId);
			
			if(parentId == null)
				discussionId = message.getId();
			
			message.setDiscussionId(discussionId);
			
			addOrUpdateMessage(forumId, message, false);
			
			NodeList repliesNodes = messageElement.getElementsByTagName(XmlDefs.REPLIES);
			if(repliesNodes.getLength() >= 1)
			{
				Node repliesNode = repliesNodes.item(0);
				NodeList replyMessageNodes = repliesNode.getChildNodes();
				mergeDescendantMessages(siteId,forumId, discussionId,message.getId(), replyMessageNodes,results);
			}
		}
	}

	public boolean parseEntityReference(String referenceString, Reference reference)
	{
		String[] parts = referenceString.split(Entity.SEPARATOR);
		
		if(!parts[0].equals(REFERENCE_ROOT))
			return false;
		
		String type = parts[1];
		
		String id = parts[2];
		
		if("messages".equals(type))
		{
			//Message message = getMessage(id);
			return true;
		}
		
		return false;
	}

	public boolean willArchiveMerge()
	{
		return true;
	}
	
	/** END EntityProducer IMPLEMENTATION */

	public Map<String,Integer> getReadMessageCountForAllFora()
	{
		return persistenceManager.getReadMessageCountForAllFora(sakaiProxy.getCurrentUser().getId());
	}

	public Map<String, Integer> getReadMessageCountForForum(String forumId)
	{
		return persistenceManager.getReadMessageCountForForum(sakaiProxy.getCurrentUser().getId(),forumId);
	}

	public Forum getForumForTitle(String title,String state)
	{
		return persistenceManager.getForumForTitle(title,state);
	}
}
