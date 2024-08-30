'use client'

import { Box, Button, Stack, TextField,  CircularProgress } from '@mui/material'
import { Mode, Send as SendIcon, CloudUpload as UploadIcon } from '@mui/icons-material'
import { useState, useRef, useEffect } from 'react'
import OpenAI from 'openai';


export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Welcome to ResearchQuery! I'm here to help you dive deep into research papers and extract the information you need. Upload a link to a paper, and ask me anything you'd like to know about it.",
    },
  ])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [link, setLink] = useState('') 


  

  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;
    setIsLoading(true)
  
    setMessage('')
    setMessages((messages) => [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ])
  
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // body: JSON.stringify([...messages, { role: 'user', content: message }]),
        body: JSON.stringify({ query: message, messages }),
      })
  
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
  
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
  
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1]
          let otherMessages = messages.slice(0, messages.length - 1)
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ]
        })
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages((messages) => [
        ...messages,
        { role: 'assistant', content: "I'm sorry, but I encountered an error. Please try again later." },
      ])
    }
    
    setIsLoading(false)
  }

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])



  const handleUpload = async () => {
    if (!link.trim()) return;

    setMessages((messages) => [
      ...messages,
      { role: 'assistant', content: 'Thank you for uploading the link! I’m verifying and loading the data now.' },
      { role: 'assistant', content: 'This may take a moment. Please be patient as I gather and analyze the information.' },
    ]);

    setLink('');
    setIsLoading(true)

    // make api call
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: link }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to load data from the link.');
      }
  
      const splitDocuments = await response.json();
  
      setMessages((messages) => [
        ...messages,
        { role: 'assistant', content: 'Data successfully loaded! What specific information would you like to explore?' },
      ]);
    } catch (error) {
      setMessages((messages) => [
        ...messages,
        { role: 'assistant', content: 'Oops! There was an issue loading the data. Please try again or check the link.' },
      ]);
    } finally {
      setIsLoading(false);
    }
    

  };





  const handleLinkKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleUpload();
    }
  }








  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="flex-start"
      paddingLeft={5}
    >
      <Stack
        direction={'column'}
        width="45%"
        height="90%"
        border="1px solid black"
        borderRadius="10px"
        p={2}
        spacing={3}
      >

        <Stack direction={'row'} spacing={2}>
          <TextField
            label="Link"
            fullWidth
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyPress={handleLinkKeyPress}
            InputProps={{
              style: { color: 'white'},
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',     
                backgroundColor: 'rgba(46, 46, 46, 0.3)', 
              },
              '& .MuiInputLabel-root': {
                color: 'rgb(217, 217, 217)',         
              },
            }}
          />

          <Button onClick={handleUpload} disabled={!link.trim()}>
            <UploadIcon style={{ fontSize: 30, color: 'white' }} />
          </Button>

        </Stack>



        <Stack
          direction={'column'}
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                message.role === 'assistant' ? 'flex-start' : 'flex-end'
              }
            >
              <Box
                bgcolor={
                  message.role === 'assistant'
                    ? 'rgba(76, 175, 80)'
                    : 'primary.main'
                }
                color="white"
                borderRadius={8}
                p={2}
              >
                {message.content}
              </Box>
            </Box>
          ))}

          <div ref={messagesEndRef} />
        </Stack>
        <Stack direction={'row'} spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            InputProps={{
              style: { color: 'white'},
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',     
                backgroundColor: 'rgba(46, 46, 46, 0.3)', 
              },
              '& .MuiInputLabel-root': {
                color: 'rgb(217, 217, 217)',         
              },
            }}

          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading}
            startIcon={
              isLoading ? (
                <CircularProgress size={40} sx={{ color: 'white' }} /> 
              ) : (
                <SendIcon  style={{ fontSize: 40, color: 'white' }} /> 
              )
            }
            >
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}